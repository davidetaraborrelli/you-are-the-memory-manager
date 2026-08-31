"""Generates src/data/levels.json - every number, trace and step the UI shows.

sim.py answers "how many faults"; the interface also needs to know *which slot*
held *which page* at every step, because it draws three tiles in fixed
positions. So the simulators here are slot-accurate: same algorithms, but they
record the frame array rather than a set.

Correctness is not taken on trust. verify_against_sim() re-derives every fault
count from these traces and asserts it matches sim.py, and sim.verify() asserts
sim.py still matches the storyboard. Both run before anything is written.

Run: python tools/gen_levels.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import sim  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "data" / "levels.json"


# --- slot-accurate simulators ----------------------------------------------
#
# Every one returns a list of steps. A step is what the UI needs to render one
# tick of the tape:
#
#   step     1-based position on the tape
#   page     the page being requested
#   outcome  'hit' | 'fill' (miss into a free slot) | 'evict' (miss, someone left)
#   slot     the frame index that ends up holding this page
#   victim   the page that was thrown out, or None
#   frames   the frame array *after* this request (None = empty slot)
#   bits     the use bits after this request (clock only)


def _step(i, page, outcome, slot, victim, frames, bits=None):
    s = {
        "step": i + 1,
        "page": page,
        "outcome": outcome,
        "slot": slot,
        "victim": victim,
        "frames": list(frames),
    }
    if bits is not None:
        s["bits"] = list(bits)
    return s


def trace_fifo(ref, n):
    frames, queue, steps = [None] * n, [], []
    for i, p in enumerate(ref):
        if p in frames:
            steps.append(_step(i, p, "hit", frames.index(p), None, frames))
            continue
        if None in frames:
            slot = frames.index(None)
            frames[slot] = p
            queue.append(slot)
            steps.append(_step(i, p, "fill", slot, None, frames))
        else:
            slot = queue.pop(0)
            victim = frames[slot]
            frames[slot] = p
            queue.append(slot)
            steps.append(_step(i, p, "evict", slot, victim, frames))
    return steps


def trace_lru(ref, n):
    frames, recency, steps = [None] * n, [], []  # recency: slots, oldest first
    for i, p in enumerate(ref):
        if p in frames:
            slot = frames.index(p)
            recency.remove(slot)
            recency.append(slot)
            steps.append(_step(i, p, "hit", slot, None, frames))
            continue
        if None in frames:
            slot = frames.index(None)
            frames[slot] = p
            recency.append(slot)
            steps.append(_step(i, p, "fill", slot, None, frames))
        else:
            slot = recency.pop(0)
            victim = frames[slot]
            frames[slot] = p
            recency.append(slot)
            steps.append(_step(i, p, "evict", slot, victim, frames))
    return steps


def trace_clock(ref, n):
    frames, bits, hand, steps = [None] * n, [0] * n, 0, []
    for i, p in enumerate(ref):
        if p in frames:
            slot = frames.index(p)
            bits[slot] = 1
            steps.append(_step(i, p, "hit", slot, None, frames, bits))
            continue
        if None in frames:
            slot = frames.index(None)
            frames[slot] = p
            bits[slot] = 1
            steps.append(_step(i, p, "fill", slot, None, frames, bits))
        else:
            while bits[hand] == 1:
                bits[hand] = 0
                hand = (hand + 1) % n
            slot, victim = hand, frames[hand]
            frames[slot] = p
            bits[slot] = 1
            hand = (hand + 1) % n
            steps.append(_step(i, p, "evict", slot, victim, frames, bits))
    return steps


def trace_opt(ref, n):
    """Screen 8 needs more than the victim: it draws a line forward from the
    evicted page to the place it is next requested. victim_next_use is that."""
    frames, steps = [None] * n, []
    for i, p in enumerate(ref):
        if p in frames:
            steps.append(_step(i, p, "hit", frames.index(p), None, frames))
            continue
        if None in frames:
            slot = frames.index(None)
            frames[slot] = p
            steps.append(_step(i, p, "fill", slot, None, frames))
        else:
            future = ref[i + 1:]
            slot, far = None, -1
            for s, m in enumerate(frames):
                nxt = future.index(m) if m in future else 10**9
                if nxt > far:
                    far, slot = nxt, s
            victim = frames[slot]
            frames[slot] = p
            step = _step(i, p, "evict", slot, victim, frames)
            # 1-based tape position where the victim is next asked for, or
            # None if it never is. This is the line screen 8 draws forward.
            step["victim_next_use"] = None if far >= 10**9 else i + far + 2
            steps.append(step)
    return steps


def faults(steps):
    return sum(1 for s in steps if s["outcome"] != "hit")


def leak_steps(steps_small, steps_big):
    """1-based steps where the small memory holds a page the big one doesn't.
    Empty for stack algorithms. Non-empty is where Belady gets in."""
    out = []
    for a, b in zip(steps_small, steps_big):
        small = {x for x in a["frames"] if x is not None}
        big = {x for x in b["frames"] if x is not None}
        if not small <= big:
            out.append(a["step"])
    return out


# --- assembly ---------------------------------------------------------------

TRACERS = {"fifo": trace_fifo, "lru": trace_lru, "clock": trace_clock, "opt": trace_opt}


def level(name, ref, frames, policies, title):
    return {
        "name": name,
        "title": title,
        "ref": ref,
        "frames": frames,
        "pages": sorted(set(ref)),
        "length": len(ref),
        "scores": {
            "fifo": sim.fifo(ref, frames),
            "lru": sim.lru(ref, frames),
            "lfu": sim.lfu(ref, frames),
            "clock": sim.clock(ref, frames),
            "opt": sim.opt(ref, frames),
            "clockNoHand": sim.clock_nohand(ref, frames),
            "clearAll": sim.clear_all(ref, frames),
            "randomAvg": round(sim.rand_avg(ref, frames), 1),
        },
        "traces": {p: TRACERS[p](ref, frames) for p in policies},
    }


def build():
    data = {
        "generatedBy": "tools/gen_levels.py - do not edit by hand",
        "levels": {
            "l1": level("l1", sim.L1, 3, ["fifo", "lru", "opt"], "Playing blind"),
            "l2": level("l2", sim.L2, 3, ["fifo", "lru", "opt"], "Recency gets easy"),
            "l3": level("l3", sim.L3, 3, ["fifo", "lru", "clock", "opt"], "One bit per page"),
        },
        # Belady is not a level the learner plays: it is two runs of the same
        # rule at 3 and 4 frames, shown side by side. It gets its own shape.
        "belady": {
            "ref": sim.BELADY,
            "pages": sorted(set(sim.BELADY)),
            "length": len(sim.BELADY),
            "runs": {},
        },
    }

    for policy in ("clock", "lru", "fifo", "opt"):
        small = TRACERS[policy](sim.BELADY, 3)
        big = TRACERS[policy](sim.BELADY, 4)
        data["belady"]["runs"][policy] = {
            "small": {"frames": 3, "faults": faults(small), "steps": small},
            "big": {"frames": 4, "faults": faults(big), "steps": big},
            "leakSteps": leak_steps(small, big),
        }
    return data


def verify_against_sim(data):
    """Every fault count the UI will show, re-derived from the traces here and
    checked against sim.py. If a trace is subtly wrong, this catches it."""
    for key, lvl in data["levels"].items():
        for policy, steps in lvl["traces"].items():
            got, want = faults(steps), lvl["scores"][policy]
            assert got == want, f"{key}/{policy}: trace says {got}, sim says {want}"

    # The storyboard's headline numbers, asserted in the shape the UI reads them.
    s1, s2, s3 = (data["levels"][k]["scores"] for k in ("l1", "l2", "l3"))
    assert (s1["fifo"], s1["lru"], s1["opt"]) == (8, 6, 5)
    assert (s2["fifo"], s2["lru"], s2["opt"]) == (10, 6, 6)
    assert s2["lfu"] == 8 == round(s2["randomAvg"])
    assert (s3["fifo"], s3["lru"], s3["clock"], s3["opt"]) == (11, 8, 8, 7)
    assert s3["clockNoHand"] == 9 and s3["clearAll"] == 9

    b = data["belady"]["runs"]
    assert (b["clock"]["small"]["faults"], b["clock"]["big"]["faults"]) == (9, 10)
    assert (b["fifo"]["small"]["faults"], b["fifo"]["big"]["faults"]) == (9, 10)
    assert (b["lru"]["small"]["faults"], b["lru"]["big"]["faults"]) == (10, 8)
    assert (b["opt"]["small"]["faults"], b["opt"]["big"]["faults"]) == (7, 6)
    assert b["clock"]["leakSteps"] == [7, 8, 11]
    assert b["lru"]["leakSteps"] == [], "LRU is monotone - screen 14 depends on it"

    # Screen 13: the leak at step 7 is page 1, upstairs and gone downstairs.
    small7 = {x for x in b["clock"]["small"]["steps"][6]["frames"] if x is not None}
    big7 = {x for x in b["clock"]["big"]["steps"][6]["frames"] if x is not None}
    assert small7 == {1, 2, 5} and big7 == {2, 3, 4, 5}

    # Screen 8 draws a forward line on every OPT eviction; it needs a target.
    evictions = [s for s in data["levels"]["l2"]["traces"]["opt"] if s["outcome"] == "evict"]
    assert evictions, "screen 8 has nothing to draw"
    assert all("victim_next_use" in s for s in evictions)


if __name__ == "__main__":
    sim.verify()
    data = build()
    verify_against_sim(data)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=1) + "\n", encoding="utf-8")
    kb = OUT.stat().st_size / 1024
    print("traces cross-checked against sim.py")
    print(f"wrote {OUT.relative_to(ROOT)} ({kb:.0f} KB)")
