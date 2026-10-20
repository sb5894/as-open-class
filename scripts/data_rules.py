"""Reviewed room/PDF rules. Source: floor-plan page 1 + docs/결정 기록.md.

Room order is relative left-to-right among the listed rooms on the same band,
not a measured drawing coordinate. Full SVG/facility geometry is step 6.
"""

BUILDINGS = [
    {"id": "main", "name": "본관", "planLabel": "본관", "campusPosition": "center", "floors": [1, 2, 3, 4]},
    {"id": "rear", "name": "후관", "planLabel": "교사 2동", "campusPosition": "top", "floors": [1, 2, 3]},
    {"id": "new", "name": "신관", "planLabel": "교사 3동", "campusPosition": "left", "floors": [1, 2, 3]},
]

# Only classrooms relevant to this event (including origin and non-public rooms).
CLASSROOM_ROWS = [
    ("main", 4, ["6-1", "6-2", "6-3", "6-4", "6-5"]),
    ("main", 3, ["5-1", "5-2", "5-3", "5-4", "5-5"]),
    ("rear", 3, ["4-1", "4-2", "4-3", "4-4", "4-5"]),
    ("rear", 2, ["1-1", "1-2", "1-3"]),
    ("new", 3, ["3-4", "3-3", "3-2", "3-1"]),
    ("new", 2, ["2-4", "2-3", "2-2", "2-1"]),
]

SPECIAL_LESSONS = {
    "1-3": {"subject": "수석교사 일반", "roomId": "classroom-1-3"},
    "5-1": {"subject": "도덕", "roomId": "science-1"},
    "4-5": {"subject": "과학", "roomId": "science-2"},
    "6-1": {"subject": "영어", "roomId": "english"},
}

MULTICULTURAL = {
    "1": {"id": "multicultural-red", "name": "다문화특별학급 1반(빨강)", "roomId": "korean-red"},
    "2": {"id": "multicultural-green", "name": "다문화특별학급 2반(초록)", "roomId": "korean-green"},
    "3": {"id": "multicultural-blue", "name": "다문화특별학급 3반(파랑)", "roomId": "multicultural-blue"},
}

# Each separate lesson intentionally has no grade-wide PDF fallback.
PDF_RULES = {
    "grade-1": {"file": "1020-additions/공개수업용지도안(1학년).pdf", "classes": ["1-1", "1-2"]},
    "grade-2": {"file": "1020-additions/공개수업용 지도안(2학년).pdf", "classes": ["2-1", "2-2", "2-3", "2-4"]},
    "grade-3": {"file": "2026 연구학교 공개보고회 수업안(3학년).pdf", "classes": ["3-2", "3-3", "3-4"]},
    "grade-4": {"file": "2026 연구학교 공개보고회 수업안(4학년).pdf", "classes": ["4-1", "4-2", "4-3", "4-4"]},
    "grade-5": {"file": "2026 연구학교 공개보고회 수업안(5학년).pdf", "classes": ["5-2", "5-3", "5-4", "5-5"]},
    "grade-6-245": {"file": "1020-additions/2026 연구학교 공개보고회 수업안(6학년 2, 4, 5반).pdf", "classes": ["6-2", "6-4", "6-5"]},
    "special-6-1": {"file": "1020-additions/2026 연구학교 공개보고회 수업안(6-1 영어- 건강 습관 보고서 쓰기).pdf", "classes": ["6-1"]},
    "multicultural-red": {"file": "1020-additions/공개수업 지도안(다문화특별학급 1반)(빨강반).pdf", "classes": ["multicultural-red"]},
    "multicultural-blue": {"file": "1020-additions/2026 연구학교 공개보고회 수업안(다문화특별학급 3반)(파랑반).pdf", "classes": ["multicultural-blue"]},
    "kindergarten": {"file": "1020-additions/2026 연구학교 공개보고회 수업안(유치원).pdf", "classes": ["kindergarten-joint"]},
}

LENSES = {"참여", "강점", "협력", "표현", "발견"}
PRIVATE_CLASSES = {"3-1": "체육 — 비공개"}

# Explicit user wording; never propagate a multicultural class topic to other classes.
TEXT_OVERRIDES = {
    "multicultural-red": {"topic": "우리 반을 글과 그림으로 소개하기"},
    "multicultural-blue": {"topic": "자신의 경험을 그림일기로 표현하기"},
    "kindergarten-joint": {"topic": "함께 가을 열매를 수확하는 협동 게임."},
}

# Preserve validation of the unchanged 261015 workbook before applying later decisions.
WORKBOOK_SPECIAL_CLASSES = {"1-3", "3-1", "4-5", "6-1"}
WORKBOOK_MISSING_CLASSES = {"5-1", "kindergarten-joint"}


def spatial_data():
    spaces, classes = [], []

    def room(room_id, name, building, floor, band, order, kind="classroom", source_label=None, subdivision=None):
        spaces.append({
            "id": room_id, "name": name, "buildingId": building, "floor": floor, "kind": kind,
            "planPosition": {"band": band, "orderFromLeft": order},
            "planLabel": source_label or name, "subdivision": subdivision,
        })

    for building, floor, labels in CLASSROOM_ROWS:
        for order, label in enumerate(labels, 1):
            room_id = "classroom-" + label
            room(room_id, label + " 교실", building, floor, "south", order, source_label=label)
            classes.append({"id": label, "name": label, "kind": "homeroom", "grade": int(label[0]),
                            "homeSpaceIds": [room_id], "isPublic": label not in PRIVATE_CLASSES})
    room("english", "영어실", "main", 4, "south", 6, "subject")
    room("science-1", "1과학실", "main", 2, "south", 2, "subject")
    room("science-2", "2과학실", "main", 2, "south", 3, "subject")
    for order, (room_id, name, kind) in enumerate([
        ("korean-red", "빨강반", "multicultural"),
        ("korean-instructor-1", "강사용 교실 1", "staff"),
        ("korean-instructor-2", "강사용 교실 2", "staff"),
        ("korean-green", "초록반", "multicultural"),
    ], 1):
        room(room_id, name, "main", 2, "north", order, kind, "한국어교실", {"part": order, "total": 4})
    room("multicultural-blue", "파랑반", "main", 2, "south", 1, "multicultural", "다문화특별학급")
    for info in MULTICULTURAL.values():
        classes.append({"id": info["id"], "name": info["name"], "kind": "multicultural", "grade": None,
                        "homeSpaceIds": [info["roomId"]], "isPublic": True})
    for order, (key, name) in enumerate([("saemmul", "샘물반"), ("haetsal", "햇살반"), ("pullip", "풀잎반")], 1):
        room_id = "kindergarten-" + key
        room(room_id, name, "main", 1, "south", order, "kindergarten")
    # Public guide uses one user-confirmed kindergarten room; source spaces above remain intact.
    room("kindergarten-public", "유치원", "main", 1, "south", 4, "kindergarten")
    classes.append({"id": "kindergarten-joint", "name": "유치원 공동 수업(샘물·햇살·풀잎반)",
                    "kind": "kindergarten", "grade": None, "homeSpaceIds": ["kindergarten-public"], "isPublic": True})
    classes.sort(key=lambda item: (
        {"homeroom": 0, "multicultural": 1, "kindergarten": 2}[item["kind"]],
        item["grade"] or 0,
        int(item["id"].split("-")[1]) if item["kind"] == "homeroom" else item["name"],
    ))
    return {"buildings": BUILDINGS, "spaces": spaces, "classes": classes}
