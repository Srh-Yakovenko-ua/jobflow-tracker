from hypothesis import strategies as st

from app.core.enums import (
    GHOSTED_STAGE,
    REJECTED_STAGE,
    load_domain_enums,
    reason_codes,
    stages_with_role,
)

reasons = st.sampled_from([*reason_codes(), None])
moves = st.tuples(st.sampled_from(load_domain_enums().stages), reasons)
open_journeys = st.lists(moves, max_size=6).map(
    lambda later: [("applied", None), *later]
)
rejected_journeys = st.tuples(open_journeys, reasons).map(
    lambda drawn: [*drawn[0], (REJECTED_STAGE, drawn[1])]
)
journeys = open_journeys | rejected_journeys
cohorts = st.lists(
    st.tuples(journeys, st.integers(min_value=1, max_value=60)),
    min_size=1,
    max_size=20,
).map(lambda drawn: [journey for journey, count in drawn for _ in range(count)])
ghosted_at_applied = st.lists(
    st.sampled_from(["applied", *stages_with_role("outcome")]).map(
        lambda stage: (stage, None)
    ),
    max_size=4,
).map(lambda later: [("applied", None), *later, (GHOSTED_STAGE, None)])
undone_moves = st.lists(moves, min_size=1, max_size=5)
