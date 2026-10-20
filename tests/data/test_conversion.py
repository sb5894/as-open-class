from copy import deepcopy
from datetime import datetime
from hashlib import sha256
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

import openpyxl
from openpyxl.utils.datetime import CALENDAR_MAC_1904, to_excel

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from convert_data import (CLASS_SHEET, DEFAULT_WORKBOOK, GRADE_SHEET, ROOT,
                          class_targets, convert, normalize_class, output_files, reports, validate_catalog)
from data_rules import PDF_RULES


class ConversionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original_hash = sha256(DEFAULT_WORKBOOK.read_bytes()).hexdigest()
        cls.data, cls.pdfs, cls.missing = convert(DEFAULT_WORKBOOK)
        cls.lessons = {item["classId"]: item for item in cls.data["lessons"]}
        cls.classes = {item["id"]: item for item in cls.data["classes"]}
        cls.spaces = {item["id"]: item for item in cls.data["spaces"]}

    def with_edited_copy(self, edit):
        # Originals are read-only; only disposable workbook copies are saved.
        (ROOT / "tmp").mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=ROOT / "tmp") as directory:
            target = Path(directory) / "new-version.xlsx"
            workbook = openpyxl.load_workbook(DEFAULT_WORKBOOK)
            edit(workbook)
            workbook.save(target)
            workbook.close()
            return convert(target)

    def test_excel_dates_and_text_labels(self):
        self.assertEqual(normalize_class(datetime(2026, 1, 1)), "1-1")
        self.assertEqual(normalize_class(datetime(2026, 6, 3)), "6-3")
        self.assertEqual(normalize_class(" 3-1\n(과학) "), "3-1")
        self.assertEqual(normalize_class("4－05"), "4-5")
        with self.assertRaises(ValueError):
            normalize_class(datetime(2026, 7, 1))
        with self.assertRaises(ValueError):
            normalize_class(46000)  # Unformatted numeric cells must not be guessed.

    def test_real_source_counts_and_private_class(self):
        self.assertEqual(len(self.lessons), 29)
        self.assertEqual(len(self.data["spaces"]), 38)
        self.assertNotIn("3-1", self.lessons)
        self.assertFalse(self.classes["3-1"]["isPublic"])
        self.assertTrue(self.classes["5-1"]["isPublic"])
        self.assertEqual(self.data["excludedClasses"][0]["classId"], "3-1")
        self.assertIn("체육", self.data["excludedClasses"][0]["reason"])
        self.assertEqual(len(self.data["excludedClasses"]), 1)
        expected_floors = {1: ("rear", 2), 2: ("new", 2), 3: ("new", 3),
                           4: ("rear", 3), 5: ("main", 3), 6: ("main", 4)}
        for school_class in self.classes.values():
            if school_class["kind"] == "homeroom":
                room = self.spaces[school_class["homeSpaceIds"][0]]
                self.assertEqual((room["buildingId"], room["floor"]), expected_floors[school_class["grade"]])

    def test_special_rooms_and_separate_pdf_absence(self):
        expected = {"1-3": ("classroom-1-3", "rear", 2), "5-1": ("science-1", "main", 2),
                    "4-5": ("science-2", "main", 2), "6-1": ("english", "main", 4)}
        for class_id, (room_id, building, floor) in expected.items():
            with self.subTest(class_id=class_id):
                lesson = self.lessons[class_id]
                self.assertEqual(lesson["spaceIds"], [room_id])
                room = self.spaces[room_id]
                self.assertEqual((room["buildingId"], room["floor"]), (building, floor))
                self.assertIsNone(lesson["lessonPlanId"])
                self.assertIsNone(lesson["topic"])
                self.assertIsNone(lesson["designFocus"])
        self.assertEqual(self.classes["3-1"]["homeSpaceIds"], ["classroom-3-1"])
        self.assertEqual(self.spaces["classroom-3-1"]["buildingId"], "new")

    def test_new_moral_lesson_does_not_reuse_prior_science_or_grade_materials(self):
        lesson = self.lessons["5-1"]
        self.assertEqual(lesson["subject"], "도덕")
        self.assertEqual(lesson["kind"], "special")
        self.assertEqual(lesson["spaceIds"], ["science-1"])
        self.assertEqual(self.classes["5-1"]["homeSpaceIds"], ["classroom-5-1"])
        for field in ("gradeTheme", "topic", "designFocus", "commonObservation", "context", "observation", "support", "lessonPlanId"):
            self.assertIsNone(lesson[field])
        self.assertEqual(lesson["lenses"], [])
        self.assertEqual(lesson["source"], {"classRow": None, "gradeRow": None})
        self.assertEqual(lesson["locationStatus"], "confirmed")

    def test_grade_six_topics_and_date_target(self):
        for class_id in ("6-2", "6-4", "6-5"):
            self.assertEqual(self.lessons[class_id]["topic"], "기후가 만든 삶, AI-3D로 만나다")
        self.assertEqual(self.lessons["6-3"]["topic"], "맞혀봐, 우리의 맛! - 쇼츠 퀴즈로 오가며 즐기기")

    def test_exception_notes_are_not_topic_targets(self):
        for note in ("1-3 수석교사 수업 별도", "3-1 과학 별도", "4-5 과학 별도", "5-1 체육(비공개)"):
            self.assertEqual(class_targets(note), [])
        self.assertEqual(class_targets("6-2, 6-4, 6-5\n(6-1 영어 별도)"), ["6-2", "6-4", "6-5"])
        self.assertEqual(class_targets("1-1, 1-2\n1-3 수석교사 수업 별도"), ["1-1", "1-2"])
        self.assertEqual(class_targets(datetime(2026, 6, 3)), ["6-3"])

    def test_all_matching_class_observations_are_reported_without_changing_data(self):
        before = deepcopy(self.data)
        report = reports(self.data, [])["docs/누락 자료.md"].decode("utf-8")
        for class_id, row in (("4-3", 32), ("6-2", 46), ("6-4", 48), ("6-5", 49)):
            self.assertIn(f"{class_id} 참관 포인트({CLASS_SHEET}!C{row})", report)
        self.assertEqual(self.data, before)

    def test_rejected_floor_review_matches_original_drawing(self):
        # Floor-plan page 1: these rooms are below the corridor, not above it.
        for room_id in ("classroom-6-2", "classroom-6-3", "kindergarten-pullip"):
            self.assertEqual(self.spaces[room_id]["planPosition"]["band"], "south")

    def test_multicultural_order_and_kindergarten_public_preserving_original_spaces(self):
        north = sorted((room for room in self.spaces.values() if room["buildingId"] == "main" and room["floor"] == 2
                        and room["planPosition"]["band"] == "north"), key=lambda room: room["planPosition"]["orderFromLeft"])
        self.assertEqual([room["id"] for room in north], ["korean-red", "korean-instructor-1", "korean-instructor-2", "korean-green"])
        self.assertEqual(self.lessons["multicultural-red"]["spaceIds"], ["korean-red"])
        self.assertEqual(self.lessons["multicultural-green"]["spaceIds"], ["korean-green"])
        self.assertEqual(self.lessons["multicultural-blue"]["spaceIds"], ["multicultural-blue"])
        self.assertEqual(self.spaces["multicultural-blue"]["planLabel"], "다문화특별학급")
        self.assertFalse(any("instructor" in room for item in self.lessons.values() for room in item["spaceIds"]))
        self.assertTrue(self.classes["kindergarten-joint"]["isPublic"])
        self.assertEqual([self.spaces['kindergarten-' + key]["name"] for key in ('saemmul', 'haetsal', 'pullip')], ["샘물반", "햇살반", "풀잎반"])
        self.assertEqual(self.classes["kindergarten-joint"]["homeSpaceIds"], ["kindergarten-public"])
        lesson = self.lessons["kindergarten-joint"]
        self.assertEqual(lesson["spaceIds"], ["kindergarten-public"])
        self.assertEqual(lesson["locationStatus"], "confirmed")
        self.assertEqual(self.spaces["kindergarten-public"]["name"], "유치원")
        self.assertEqual(self.spaces["kindergarten-public"]["floor"], 1)
        for field in ("gradeTheme", "topic", "designFocus", "commonObservation", "context", "observation", "support", "lessonPlanId"):
            self.assertIsNone(lesson[field])
        self.assertEqual(lesson["lenses"], [])
        self.assertNotIn("public/pdfs/kindergarten.pdf", self.pdfs)

    def test_no_invented_text_or_lenses_and_preserve_partial_text(self):
        self.assertIsNone(self.lessons["1-1"]["topic"])
        self.assertIsNone(self.lessons["5-2"]["context"])
        self.assertEqual(self.lessons["2-3"]["lenses"], ["참여", "표현"])
        self.assertEqual(self.lessons["4-3"]["lenses"], [])
        self.assertEqual(self.lessons["multicultural-red"]["observation"], "한국어 표현에 어려움이 있는 다문화 학생들이")
        self.assertIsNone(self.lessons["multicultural-blue"]["topic"])

    def test_pdf_bytes_and_allowed_class_mappings(self):
        self.assertEqual(len(self.pdfs), 3)
        for plan in self.data["lessonPlans"]:
            original = (ROOT / plan["source"]["path"]).read_bytes()
            self.assertEqual(self.pdfs["public" + plan["url"]], original)
        for class_id in ("3-2", "3-3", "3-4"):
            self.assertEqual(self.lessons[class_id]["lessonPlanId"], "grade-3")
        for class_id in ("4-1", "4-2", "4-3", "4-4"):
            self.assertEqual(self.lessons[class_id]["lessonPlanId"], "grade-4")
        for class_id in ("5-2", "5-3", "5-4", "5-5"):
            self.assertEqual(self.lessons[class_id]["lessonPlanId"], "grade-5")

    def test_missing_pdf_file_removes_link_without_fallback(self):
        missing_rule = {**PDF_RULES["grade-3"], "file": "test-nonexistent-source.pdf"}
        with patch.dict(PDF_RULES, {"grade-3": missing_rule}):
            data, pdfs, missing_files = convert(DEFAULT_WORKBOOK)
        self.assertIn("test-nonexistent-source.pdf", missing_files)
        self.assertNotIn("public/pdfs/grade-3.pdf", pdfs)
        self.assertFalse(any(plan["id"] == "grade-3" for plan in data["lessonPlans"]))
        for lesson in data["lessons"]:
            if lesson["classId"] in ("3-1", "3-2", "3-3", "3-4"):
                self.assertIsNone(lesson["lessonPlanId"])

    def test_new_workbook_changes_values_without_fixed_row_numbers(self):
        def edit(workbook):
            sheet = workbook[CLASS_SHEET]
            sheet["B10"] = "추가 자료의 학급 설명"
            sheet.insert_rows(9)
            # Insert inside the data area; later header merged ranges are not relied on.
            workbook[GRADE_SHEET]["C13"] = "새로운 6-3 수업 주제"
        data, _, _ = self.with_edited_copy(edit)
        lessons = {item["classId"]: item for item in data["lessons"]}
        self.assertEqual(lessons["1-2"]["context"], "추가 자료의 학급 설명")
        self.assertEqual(lessons["1-2"]["source"]["classRow"]["row"], 11)
        self.assertEqual(lessons["6-3"]["topic"], "새로운 6-3 수업 주제")
        self.assertEqual(lessons["6-2"]["topic"], self.lessons["6-2"]["topic"])

    def test_date_epoch_1904_is_normalized(self):
        def edit(workbook):
            workbook.epoch = CALENDAR_MAC_1904
            # Save a serial with date format to exercise actual XLSX deserialization.
            cell = workbook[CLASS_SHEET]["A9"]
            cell.value = to_excel(datetime(2026, 1, 1), workbook.epoch)
            cell.number_format = "m\\-d"
        data, _, _ = self.with_edited_copy(edit)
        self.assertIn("1-1", {item["classId"] for item in data["lessons"]})

    def test_invalid_source_rows_and_ambiguous_topics_fail(self):
        edits = [lambda w: setattr(w[GRADE_SHEET]["F13"], "value", None),
                 lambda w: setattr(w[CLASS_SHEET]["A9"], "value", None),
                 lambda w: setattr(w[CLASS_SHEET]["A10"], "value", "1-1"),
                 lambda w: setattr(w[CLASS_SHEET]["D10"], "value", "임의 렌즈"),
                 lambda w: setattr(w[CLASS_SHEET]["B10"], "value", '=CONCAT("추정", "내용")')]
        for edit in edits:
            with self.subTest(edit=edit), self.assertRaises(ValueError):
                self.with_edited_copy(edit)

    def test_validation_rejects_wrong_location_private_class_and_pdf(self):
        for class_id, field, wrong in [("5-1", "spaceIds", ["classroom-5-1"]),
                                       ("4-5", "spaceIds", ["science-1"]),
                                       ("6-1", "spaceIds", ["classroom-6-1"]),
                                       ("multicultural-red", "spaceIds", ["korean-instructor-1"]),
                                       ("5-1", "lessonPlanId", "grade-5")]:
            data = deepcopy(self.data)
            next(item for item in data["lessons"] if item["classId"] == class_id)[field] = wrong
            with self.subTest(class_id=class_id, field=field), self.assertRaises(ValueError):
                validate_catalog(data)
        for private_class in ("3-1",):
            data = deepcopy(self.data)
            data["lessons"][0]["classId"] = private_class
            with self.assertRaises(ValueError):
                validate_catalog(data)

    def test_repeat_conversion_is_deterministic_and_original_unchanged(self):
        again = convert(DEFAULT_WORKBOOK)
        self.assertEqual(output_files(self.data, self.pdfs, self.missing), output_files(*again))
        self.assertEqual(sha256(DEFAULT_WORKBOOK.read_bytes()).hexdigest(), self.original_hash)


if __name__ == "__main__":
    unittest.main()
