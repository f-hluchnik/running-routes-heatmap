"use strict";

/**
 * Which runs are shown: every run can be switched off individually, and a date
 * range can hide runs outside it. A run is visible when it passes both.
 * Dates are ISO strings (YYYY-MM-DD), which compare correctly as plain strings;
 * runs without a date always pass the date range.
 */
class RunFilter {
  constructor(runs) {
    this.runs = runs;
    this.switchedOff = new Set();
    this.from = "";
    this.to = "";
  }

  inDateRange(runIndex) {
    const { date } = this.runs[runIndex];
    if (!date) return true;
    return (!this.from || date >= this.from) && (!this.to || date <= this.to);
  }

  isSwitchedOn(runIndex) {
    return !this.switchedOff.has(runIndex);
  }

  isVisible(runIndex) {
    return this.isSwitchedOn(runIndex) && this.inDateRange(runIndex);
  }

  setSwitchedOn(runIndex, on) {
    if (on) this.switchedOff.delete(runIndex);
    else this.switchedOff.add(runIndex);
  }

  setAllSwitchedOn(on) {
    this.switchedOff = on ? new Set() : new Set(this.runs.keys());
  }

  setDateRange(from, to) {
    this.from = from;
    this.to = to;
  }

  visibleRuns() {
    return this.runs.filter((_, index) => this.isVisible(index));
  }
}

if (typeof module !== "undefined" && module.exports) module.exports = { RunFilter };
