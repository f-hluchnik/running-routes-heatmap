from __future__ import annotations

from running_heatmap.loading import load_runs

LINE = [(16.60, 49.20), (16.601, 49.201), (16.602, 49.202)]


def test_reads_gpx_and_fit_in_name_order_and_ignores_other_files(write_gpx, write_fit, tmp_path):
    write_gpx("b.gpx", LINE, name="B")
    write_fit("a.fit", LINE)
    write_gpx("empty.gpx")
    (tmp_path / "notes.txt").write_text("ignore me")

    runs = load_runs(tmp_path)

    assert [run.name for run in runs] == ["a", "B"]


def test_extension_match_is_case_insensitive(write_fit, tmp_path):
    write_fit("a.fit", LINE).rename(tmp_path / "A.FIT")

    assert len(load_runs(tmp_path)) == 1


def test_sport_filter_drops_other_sports_but_keeps_unlabelled_activities(
    write_gpx, write_fit, tmp_path
):
    write_fit("run.fit", LINE, sport="running")
    write_fit("ride.fit", LINE, sport="cycling")
    write_fit("unknown.fit", LINE, sport=None)
    write_gpx("track.gpx", LINE)

    runs = load_runs(tmp_path, sport="running")

    assert sorted(run.name for run in runs) == ["Test run", "run", "unknown"]


def test_without_sport_filter_everything_is_loaded(write_fit, tmp_path):
    write_fit("run.fit", LINE, sport="running")
    write_fit("ride.fit", LINE, sport="cycling")

    assert len(load_runs(tmp_path)) == 2
