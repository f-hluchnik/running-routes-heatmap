# RH-003 Geometry: projection, simplify, resample

**Status:** Done

## Goal
Work in metres so "within 10 m" means the same thing east-west and north-south,
and give every run an even point density.

## Acceptance criteria
- `LocalProjection` converts lon/lat <-> metres and round-trips.
- `clean_path` removes jitter (Douglas-Peucker, 1 m) then splits steps to <= 5 m.
- Paths with zero length produce an empty array instead of crashing.

## Decisions
- Equirectangular projection around the data's bounding-box centre instead of
  `pyproj`: error is far below GPS noise for a city and it saves a dependency.
- Simplify **before** re-sampling: removes the standing-still clusters that would
  otherwise inflate point counts.

## Refactor notes
- `_metres_per_degree` returns a numpy array directly; the duplicated
  `np.array(...)` wrapping in `forward`/`inverse` is gone.
