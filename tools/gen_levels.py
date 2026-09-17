"""Generates src/data/levels.json - every number, trace and step the UI shows.

sim.py answers "how many faults"; the interface also needs to know *which slot*
held *which page* at every step, because it draws three tiles in fixed
positions. So the simulators here are slot-accurate: same algorithms, but they
record the frame array rather than a set. Clock's full events come directly
from sim.clock_events(), including the scan that produces each result.

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
#   handBefore / handAfter  zero-based hand positions (clock only)
#   scanned  inspected slots, including the final zero-bit victim; empty on
#            hits/fills, with a repeated starting slot after a full sweep


def _step(i, page, outcome, slot, victim, frames):
    return {
        "step": i + 1,
        "page": page,
        "outcome": outcome,
        "slot": slot,
        "victim": victim,
        "frames": list(frames),
    }


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
    # One canonical source for both residency and the intermediate scans.
    return sim.clock_events(ref, n)


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
        # Screen 7 replays the first eviction where arrival order, recency and
        # frequency disagree, then reveals what each victim did next. Which page
        # each signal points at is a simulator answer, not an interface one.
        "fork": fork(ref, frames),
        # Screen 8 hands the learner the finished tape and asks them to replay
        # it themselves. What it needs at each fork is the option table: every
        # resident page and the step it comes back on, which is what the
        # refusal of a wrong tap quotes back at them.
        "decisions": decisions(ref, frames),
        # And the argument for why the count they land on is the floor.
        "floor": floor(ref, frames),
    }


def fork(ref, frames):
    f = sim.first_signal_fork(ref, frames)
    if f is None:
        return None
    return {
        "step": f["step"],
        "request": f["request"],
        "mem": list(f["mem"]),
        "fifo": f["fifo"],
        "lru": f["lru"],
        "lfu": f["lfu"],
        "nextUse": {str(k): v for k, v in f["next_use"].items()},
    }


def decisions(ref, frames):
    """Every eviction a learner faces replaying the tape with the future visible.

    One entry per fork: the resident pages, the step each of them comes back on
    (None if it never does), and the page OPT drops. Screen 8 reads this to
    refuse a wrong tap with a fact instead of a hint, so the fact has to be the
    simulator's rather than the interface's.
    """
    return [
        {
            "step": step,
            "request": ref[step - 1],
            "mem": list(opts),
            "nextUse": {str(page): nxt for page, nxt in opts.items()},
            "victim": victim,
        }
        for step, opts, victim in sim.face_up_decisions(ref, frames)
    ]


def floor(ref, frames):
    """The lower bound, in the two parts screen 8 shows on the tape."""
    f = sim.floor_argument(ref, frames)
    return {
        "firstUses": {str(page): step for page, step in f["first_uses"].items()},
        "unavoidable": f["unavoidable"],
        "forcedStep": f["forced_step"],
        "forcedRequest": f["forced_request"],
        "resident": list(f["resident"]),
        "residentNextUse": {str(p): n for p, n in f["resident_next_use"].items()},
        "atLeast": f["at_least"],
        "achieved": f["achieved"],
    }


def build():
    data = {
        "generatedBy": "tools/gen_levels.py - do not edit by hand",
        "recencyDemo": sim.recency_demo(),
        "clockQuickCheck": sim.clock_quick_check(),
        "transfer": sim.transfer_example(),
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
    """Check totals, complete Clock events and the storyboard's key states."""
    assert data['transfer'] == sim.transfer_example(), 'screen 14 evidence differs from the oracle'
    for key, lvl in data["levels"].items():
        for policy, steps in lvl["traces"].items():
            got, want = faults(steps), lvl["scores"][policy]
            assert got == want, f"{key}/{policy}: trace says {got}, sim says {want}"
            if policy == "clock":
                assert steps == sim.clock_events(lvl["ref"], lvl["frames"]), \
                    f"{key}/clock: events differ from the oracle"

    for size in ("small", "big"):
        run = data["belady"]["runs"]["clock"][size]
        assert run["steps"] == sim.clock_events(data["belady"]["ref"], run["frames"]), \
            f"belady/clock/{size}: events differ from the oracle"

    # The storyboard's headline numbers, asserted in the shape the UI reads them.
    s1, s2, s3 = (data["levels"][k]["scores"] for k in ("l1", "l2", "l3"))
    assert (s1["fifo"], s1["lru"], s1["opt"]) == (8, 6, 5)
    assert (s2["fifo"], s2["lru"], s2["lfu"], s2["opt"]) == (9, 7, 9, 6)
    assert (s3["fifo"], s3["lru"], s3["clock"], s3["opt"]) == (11, 8, 8, 7)
    assert s3["clockNoHand"] == 9 and s3["clearAll"] == 9

    b = data["belady"]["runs"]
    assert (b["clock"]["small"]["faults"], b["clock"]["big"]["faults"]) == (9, 10)
    assert (b["fifo"]["small"]["faults"], b["fifo"]["big"]["faults"]) == (9, 10)
    assert (b["lru"]["small"]["faults"], b["lru"]["big"]["faults"]) == (10, 8)
    assert (b["opt"]["small"]["faults"], b["opt"]["big"]["faults"]) == (7, 6)
    assert b["clock"]["leakSteps"][0] == 7, "screen 12 asks for the first leak"
    assert b["lru"]["leakSteps"] == [], "LRU is monotone - screen 13 depends on it"

    # Screen 12: the leak at step 7 is page 1, upstairs and gone downstairs.
    small7 = {x for x in b["clock"]["small"]["steps"][6]["frames"] if x is not None}
    big7 = {x for x in b["clock"]["big"]["steps"][6]["frames"] if x is not None}
    assert small7 == {1, 2, 5} and big7 == {2, 3, 4, 5}

    # Screen 8 replays L1 face up and draws a forward line on every OPT
    # eviction, so each one needs a target. It moved from L2 to L1 in the
    # 31 Aug revision: the floor of 5 the learner was promised on screen 4 is
    # L1's, and proving it on a different tape would prove nothing.
    evictions = [s for s in data["levels"]["l1"]["traces"]["opt"] if s["outcome"] == "evict"]
    assert len(evictions) == 2, "screen 8 quotes two forks on L1"
    assert all("victim_next_use" in s for s in evictions)

    # The forks the learner actually plays, in the shape the screen reads them.
    # Two decisions and only two is what lets screen 8 be one continuous replay
    # with no guided multistep: there is nothing to guide through.
    d1 = data["levels"]["l1"]["decisions"]
    assert [d["step"] for d in d1] == [5, 10], "screen 8 plays two forks"
    assert d1[0]["nextUse"] == {"1": 6, "2": 8, "3": 10} and d1[0]["victim"] == 3
    assert d1[1]["nextUse"] == {"1": None, "2": 11, "4": 13} and d1[1]["victim"] == 1
    # Every option carries a checkable fact, or a refusal would have to hint.
    assert all(len(d["nextUse"]) == 3 for d in d1)

    # Beat 4 proves the floor rather than asserting it: four pages that each
    # have to enter once, plus one forced when the fifth request finds memory
    # full. The learner's own run is what makes the bound a floor.
    fl = data["levels"]["l1"]["floor"]
    assert (fl["unavoidable"], fl["forcedStep"], fl["forcedRequest"]) == (4, 5, 4)
    assert fl["firstUses"] == {"1": 1, "2": 2, "3": 3, "4": 5}
    assert fl["residentNextUse"] == {"1": 6, "2": 8, "3": 10}
    assert fl["atLeast"] == fl["achieved"] == s1["opt"] == 5

    # Screen 7 replays this fork and reveals what each victim did next. Three
    # signals, three different pages, and only recency drops the one that never
    # comes back - that is the whole argument of act 3.
    f = data["levels"]["l2"]["fork"]
    assert f["step"] == 7 and f["request"] == 4 and sorted(f["mem"]) == [1, 2, 3]
    assert (f["fifo"], f["lru"], f["lfu"]) == (1, 2, 3)
    assert f["nextUse"] == {"1": 9, "2": None, "3": 10}


def render(data):
    """The exact bytes this generator writes. One definition, so --check
    compares against what a real run would produce and not an approximation."""
    return json.dumps(data, indent=1) + "\n"


if __name__ == "__main__":
    # --check regenerates everything in memory and compares, without touching
    # the file. That is what lets `npm test` run it: the gate can fail on drift
    # without ever leaving a dirty working tree behind, and a test that rewrote
    # its own input would be checking nothing.
    #
    # Added 3 Sep 2026. The project rule is that Python owns every number, but
    # nothing enforced it: levels.json was generated by hand, committed, and
    # then read by a UI and a test suite that both trusted it. An edit to the
    # committed file, or a change here that nobody re-ran, was invisible.
    check_only = "--check" in sys.argv

    sim.verify()
    data = build()
    verify_against_sim(data)
    rendered = render(data)

    if check_only:
        if not OUT.exists():
            print(f"FAIL {OUT.relative_to(ROOT)} does not exist. Run: npm run data")
            sys.exit(1)
        current = OUT.read_text(encoding="utf-8")
        if current != rendered:
            print(f"FAIL {OUT.relative_to(ROOT)} differs from the generator.")
            print("     The committed data is not what tools/gen_levels.py produces.")
            print("     Run `npm run data` and commit the result, or fix the generator.")
            a, b = current.splitlines(), rendered.splitlines()
            for i in range(max(len(a), len(b))):
                x = a[i] if i < len(a) else "<end of file>"
                y = b[i] if i < len(b) else "<end of file>"
                if x != y:
                    print(f"     first difference on line {i + 1}:")
                    print(f"       committed: {x[:100]}")
                    print(f"       generator: {y[:100]}")
                    break
            sys.exit(1)
        print("traces cross-checked against sim.py")
        print(f"{OUT.relative_to(ROOT)} matches the generator")
    else:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(rendered, encoding="utf-8")
        kb = OUT.stat().st_size / 1024
        print("traces cross-checked against sim.py")
        print(f"wrote {OUT.relative_to(ROOT)} ({kb:.0f} KB)")
