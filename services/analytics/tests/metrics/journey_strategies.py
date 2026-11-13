from hypothesis import strategies as st

from app.core.enums import REJECTED_STAGE, load_domain_enums, reason_codes

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
