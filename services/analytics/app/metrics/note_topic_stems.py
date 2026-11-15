from collections.abc import Mapping
from typing import Final

TOPIC_STEMS: Final[Mapping[str, tuple[str, ...]]] = {
    "algorithms": (
        r"live ?cod",
        r"лайв ?код",
        r"алгоритм",
        r"algorithm",
        r"leet ?code",
        r"літкод",
        r"литкод",
    ),
    "dp": (
        r"dp\b",
        r"дп\b",
        r"dynamic programming",
        r"динамічн\w* програмуванн",
        r"динамическ\w* программировани",
    ),
    "system_design": (
        r"system ?design",
        r"систем\w* дизайн",
        r"про[еє]ктуванн\w* систем",
        r"проектировани\w* систем",
    ),
    "english": (r"english", r"англ"),
    "take_home": (
        r"take ?home",
        r"test ?task",
        r"тестов\w* (завданн|задани)",
        r"домашн\w* (завданн|задани)",
    ),
    "react_internals": (
        r"react ?internals",
        r"react ?fiber",
        r"reconcil",
        r"virtual ?dom",
        r"(віртуальн|виртуальн)\w* (dom|дом)\b",
        r"реконсил",
    ),
    "sql": (r"sql\b", r"mysql\b", r"postgre"),
    "behavioural": (
        r"behaviou?ral",
        r"soft ?skill",
        r"софт ?ск[іи]л",
        r"поведінков",
        r"поведенческ",
    ),
}
