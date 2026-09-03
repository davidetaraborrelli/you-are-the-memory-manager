import itertools, random

def fifo(ref, n):
    mem, q, f = set(), [], 0
    for p in ref:
        if p not in mem:
            f += 1
            if len(mem) == n:
                v = q.pop(0); mem.remove(v)
            mem.add(p); q.append(p)
    return f

def lru(ref, n):
    mem, f = [], 0
    for p in ref:
        if p in mem:
            mem.remove(p); mem.append(p)
        else:
            f += 1
            if len(mem) == n: mem.pop(0)
            mem.append(p)
    return f

def opt(ref, n):
    mem, f = [], 0
    for i, p in enumerate(ref):
        if p in mem: continue
        f += 1
        if len(mem) == n:
            far, victim = -1, None
            for m in mem:
                nxt = ref[i+1:].index(m) if m in ref[i+1:] else 10**9
                if nxt > far: far, victim = nxt, m
            mem.remove(victim)
        mem.append(p)
    return f

def clock(ref, n):
    frames, bits, hand, f = [], [], 0, 0
    for p in ref:
        if p in frames:
            bits[frames.index(p)] = 1
            continue
        f += 1
        if len(frames) < n:
            frames.append(p); bits.append(1)
        else:
            while bits[hand] == 1:
                bits[hand] = 0; hand = (hand + 1) % n
            frames[hand] = p; bits[hand] = 1; hand = (hand + 1) % n
    return f

def first_decision(ref, n):
    """index of the first request that forces an eviction choice"""
    mem = []
    for i, p in enumerate(ref):
        if p in mem: continue
        if len(mem) == n: return i
        mem.append(p)
    return None

def fifo_trap(ref, n):
    """True if FIFO's first eviction victim is requested again immediately after"""
    mem, q = set(), []
    for i, p in enumerate(ref):
        if p not in mem:
            if len(mem) == n:
                v = q.pop(0); mem.remove(v)
                return i + 1 < len(ref) and ref[i+1] == v
            mem.add(p); q.append(p)
    return False

def locality_score(ref):
    """mean gap between repeats; lower = more temporal locality"""
    last, gaps = {}, []
    for i, p in enumerate(ref):
        if p in last: gaps.append(i - last[p])
        last[p] = i
    return sum(gaps)/len(gaps) if gaps else 99


# ---------------------------------------------------------------------------
# Added 27 Aug 2026, after the pedagogy audit.
# Everything the storyboard quotes is asserted by verify() below.
# ---------------------------------------------------------------------------

def clock_nohand(ref, n):
    """Clock that forgets where it stopped: scans from index 0 every fault.
    This is what a learner who clears bits but keeps no state scores."""
    frames, bits, f = [], [], 0
    for p in ref:
        if p in frames:
            bits[frames.index(p)] = 1
            continue
        f += 1
        if len(frames) < n:
            frames.append(p); bits.append(1); continue
        i = 0
        while bits[i] == 1:
            bits[i] = 0; i = (i + 1) % n
        frames[i] = p; bits[i] = 1
    return f

def clear_all(ref, n):
    """'When every bit is 1, clear them all and evict the first.'
    The other natural first attempt on screen 9/10."""
    frames, bits, f = [], [], 0
    for p in ref:
        if p in frames:
            bits[frames.index(p)] = 1
            continue
        f += 1
        if len(frames) < n:
            frames.append(p); bits.append(1); continue
        if all(bits): bits = [0] * n
        i = bits.index(0); frames[i] = p; bits[i] = 1
    return f

def lfu(ref, n):
    """Least frequently used: drop whatever has been needed fewest times.

    Added 29 Aug 2026. Screen 5's options have to name four *different*
    measurable things, and 'how many times' is the one the option list was
    missing — it is misconception M4 (recent = frequent = important), which
    the design document lists but the lesson never gave the learner a way to
    say out loud. Ties break by least recent, the charitable reading.
    """
    mem, count, recency, f = [], {}, [], 0
    for p in ref:
        count[p] = count.get(p, 0) + 1
        if p in mem:
            recency.remove(p); recency.append(p); continue
        f += 1
        if len(mem) == n:
            v = min(mem, key=lambda m: (count[m], recency.index(m)))
            mem.remove(v); recency.remove(v)
        mem.append(p); recency.append(p)
    return f

def lfu_by_arrival(ref, n):
    """LFU with the *other* natural tie-break: oldest arrival wins.

    Exists to prove the tie-break is load-bearing rather than a detail. Screen 7
    quotes a single number for the declared rule "played to the letter"; if two
    reasonable readings of that rule give different numbers, the lesson has to
    say which one it means.
    """
    mem, count, order, f = [], {}, [], 0
    for p in ref:
        count[p] = count.get(p, 0) + 1
        if p in mem:
            continue
        f += 1
        if len(mem) == n:
            v = min(mem, key=lambda m: (count[m], order.index(m)))
            mem.remove(v); order.remove(v)
        mem.append(p); order.append(p)
    return f

def lfu_ties(ref, n):
    """Decisions on LFU's own path where the lowest count is shared.

    "Drop whichever was needed fewest times" is under-determined: it says
    nothing about ties. Recency and arrival order can never tie (one request
    per step, so their values are distinct by construction) but counts tie
    often, and on L2 the reference path hits one at step 15 with all three
    pages at four uses. Which page leaves there decides the whole score, so
    the tutor states the tie-break when handing the panel to a learner who
    declared counting.
    """
    mem, count, recency, ties = [], {}, [], 0
    for p in ref:
        count[p] = count.get(p, 0) + 1
        if p in mem:
            recency.remove(p); recency.append(p); continue
        if len(mem) == n:
            lo = min(count[m] for m in mem)
            if sum(1 for m in mem if count[m] == lo) > 1:
                ties += 1
            v = min(mem, key=lambda m: (count[m], recency.index(m)))
            mem.remove(v); recency.remove(v)
        mem.append(p); recency.append(p)
    return ties

def rand_avg(ref, n, runs=20000, seed=0):
    """Average faults of a uniformly random evictor. Baseline for 'guessing'."""
    r, total = random.Random(seed), 0
    for _ in range(runs):
        mem, f = [], 0
        for p in ref:
            if p in mem: continue
            f += 1
            if len(mem) == n: mem.pop(r.randrange(n))
            mem.append(p)
        total += f
    return total / runs

# --- per-step traces: what is in memory after each request -----------------

def trace_fifo(ref, n):
    mem, q, out = set(), [], []
    for p in ref:
        if p not in mem:
            if len(mem) == n:
                v = q.pop(0); mem.remove(v)
            mem.add(p); q.append(p)
        out.append(frozenset(mem))
    return out

def trace_lru(ref, n):
    mem, out = [], []
    for p in ref:
        if p in mem: mem.remove(p); mem.append(p)
        else:
            if len(mem) == n: mem.pop(0)
            mem.append(p)
        out.append(frozenset(mem))
    return out

def trace_clock(ref, n):
    frames, bits, hand, out = [], [], 0, []
    for p in ref:
        if p in frames:
            bits[frames.index(p)] = 1
        elif len(frames) < n:
            frames.append(p); bits.append(1)
        else:
            while bits[hand] == 1:
                bits[hand] = 0; hand = (hand + 1) % n
            frames[hand] = p; bits[hand] = 1; hand = (hand + 1) % n
        out.append(frozenset(frames))
    return out

def leak_steps(trace_fn, ref, small, big):
    """1-based steps where memory@small is NOT a subset of memory@big.
    Empty for stack algorithms (LRU, OPT). Non-empty is Belady's door."""
    a, b = trace_fn(ref, small), trace_fn(ref, big)
    return [i + 1 for i in range(len(ref)) if not a[i] <= b[i]]

def run_log(ref, n, policy):
    """Step-by-step log under a policy ('fifo'|'lru'|'opt'), with regret
    attribution and 'never came back' credit — the two feedback mechanics."""
    mem, q, lr, log, evicted_at = [], [], [], [], {}
    for i, p in enumerate(ref):
        if p in mem:
            lr.remove(p); lr.append(p)
            log.append((i + 1, p, 'hit', None, None)); continue
        ev = None
        if len(mem) == n:
            if policy == 'fifo': ev = q[0]
            elif policy == 'lru': ev = lr[0]
            else:
                far = -1
                for m in mem:
                    nxt = ref[i+1:].index(m) if m in ref[i+1:] else 10**9
                    if nxt > far: far, ev = nxt, m
            mem[mem.index(ev)] = p; q.remove(ev); lr.remove(ev)
        else:
            mem.append(p)
        q.append(p); lr.append(p)
        regret = f'dropped {i - evicted_at[p]} steps ago' if p in evicted_at else None
        evicted_at.pop(p, None)
        if ev is not None: evicted_at[ev] = i
        log.append((i + 1, p, 'MISS', ev, regret))
    credit = [pg for pg, i in evicted_at.items() if pg not in ref[i+1:]]
    return log, credit

def next_use(ref, i, page):
    """1-based step at which `page` is next requested after index i, or None."""
    for j in range(i + 1, len(ref)):
        if ref[j] == page:
            return j + 1
    return None

def face_up_decisions(ref, n):
    """Every eviction a learner faces replaying `ref` with the whole tape visible.

    Returns [(step, {page: next use or None}, correct victim), ...].

    Added 31 Aug 2026 for the rewritten screen 8. The screen hands the learner a
    finished tape and asks them to play it themselves, so what it has to quote is
    not a fault count but the option table at each fork, and above all how many
    forks there are at all. On L1 the answer is two, which is why the screen needs
    no guided multistep: there is nothing to guide through.
    """
    mem, out = [], []
    for i, p in enumerate(ref):
        if p in mem:
            continue
        if len(mem) == n:
            opts = {m: next_use(ref, i, m) for m in mem}
            victim = max(mem, key=lambda m: opts[m] if opts[m] else 10**9)
            out.append((i + 1, opts, victim))
            mem[mem.index(victim)] = p
        else:
            mem.append(p)
    return out


def floor_argument(ref, n):
    """Why the floor is the floor, as the two facts it rests on.

    1. Every distinct page has to be fetched at least once. The number of
       distinct pages is therefore a lower bound nobody can argue with.
    2. The first request that arrives with memory already full forces one more,
       *provided* every page it could displace is requested again afterwards:
       whichever one leaves has to come back a second time.

    Added 3 Sep 2026 for screen 8's beat 4. The screen shows both facts on the
    tape and then says the number out loud, so both are derived here rather
    than asserted in the copy. `at_least` is the bound they add up to; the
    screen may only call it *the floor* because `achieved` reaches it.
    """
    first_uses, seen = {}, []
    for i, p in enumerate(ref):
        if p not in first_uses:
            first_uses[p] = i + 1

    i = first_decision(ref, n)
    if i is None:
        return {
            'first_uses': first_uses,
            'unavoidable': len(first_uses),
            'forced_step': None,
            'forced_request': None,
            'resident': (),
            'resident_next_use': {},
            'at_least': len(first_uses),
            'achieved': opt(ref, n),
        }

    for p in ref[:i]:
        if p not in seen:
            seen.append(p)
    resident_next_use = {m: next_use(ref, i, m) for m in seen}
    # The forced fault only follows if every resident is asked for again. A page
    # that never returns can be dropped for free, and then this second fact
    # proves nothing: the bound stays at the cold misses.
    forced = all(v is not None for v in resident_next_use.values())
    return {
        'first_uses': first_uses,
        'unavoidable': len(first_uses),
        'forced_step': i + 1,
        'forced_request': ref[i],
        'resident': tuple(seen),
        'resident_next_use': resident_next_use,
        'at_least': len(first_uses) + (1 if forced else 0),
        'achieved': opt(ref, n),
    }


def first_signal_fork(ref, n):
    """First eviction fork, annotated with the three past-looking signals.

    Returns the step, resident pages, the FIFO/LRU/LFU victims, and each
    resident page's next use. This is the pedagogical hinge of act 3: on the
    revised L2 the three signals point at three different pages.
    """
    mem, arrival, last, count = [], {}, {}, {}
    for i, p in enumerate(ref):
        count[p] = count.get(p, 0) + 1
        last[p] = i
        if p in mem:
            continue
        if len(mem) < n:
            mem.append(p); arrival[p] = i
            continue

        fifo_v = min(mem, key=lambda m: arrival[m])
        lru_v = min(mem, key=lambda m: last[m])
        lfu_v = min(mem, key=lambda m: (count[m], last[m]))
        return {
            'step': i + 1,
            'request': p,
            'mem': tuple(mem),
            'fifo': fifo_v,
            'lru': lru_v,
            'lfu': lfu_v,
            'next_use': {m: next_use(ref, i, m) for m in mem},
        }
    return None


# --- the four strings the lesson uses ---------------------------------------

L1 = [1, 2, 3, 1, 4, 1, 1, 2, 4, 3, 2, 2, 4, 3]           # 4 pages
L2 = [1, 2, 2, 2, 3, 1, 4, 5, 1, 3, 5, 1, 1, 4, 5]        # 5 pages
L3 = [1, 3, 2, 5, 3, 4, 3, 5, 4, 2, 5, 5, 4, 4, 3, 2]     # 5 pages
BELADY = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5]             # Silberschatz

def verify():
    """Asserts the lesson's current numerical and pedagogical invariants. Run: python3 sim.py"""
    # Level 1 — first decision winnable by reasoning
    assert (fifo(L1, 3), lru(L1, 3), opt(L1, 3)) == (8, 6, 5)
    assert first_decision(L1, 3) == 4                       # step 5, 0-based 4
    assert L1[3] == 1                                       # one hit before it
    assert fifo_trap(L1, 3)                                 # FIFO victim (1) returns next step
    log, credit = run_log(L1, 3, 'lru')
    assert log[4][3] == 2 and log[5][2] == 'hit'            # LRU drops 2, keeps 1, rewarded
    assert log[7][4] == 'dropped 3 steps ago'               # first LRU regret at step 8
    assert all(s[2] == 'hit' for s in log[-4:])             # ends on 4 hits
    assert credit == [1]                                    # page 1 never came back
    assert 6.3 < rand_avg(L1, 3) < 6.9

    # --- Act 4, screen 8: level 1 replayed with the tape face up ------------
    # Rewritten 31 Aug 2026. The block this replaces asserted a comparison
    # between the learner's recency run and the floor ("you dropped 2, I dropped
    # 3"), which was the spoiler the screen printed two bubbles before asking
    # the learner to choose. The screen makes no comparison now: the learner
    # replays the whole of level 1 with the future visible and reaches 5 by
    # their own hand. So what has to hold is the option table at each fork.
    dec = face_up_decisions(L1, 3)
    assert [d[0] for d in dec] == [5, 10]                     # two decisions, and only two
    assert opt(L1, 3) == 5                                    # and they add up to the floor
    o = run_log(L1, 3, 'opt')[0]

    # Beat 2 opens on a replay: three trips nobody can avoid, then page 1 is
    # asked for again and is still in a slot. Four steps go by before the
    # learner's first real choice, and the screen plays all four for them.
    assert len(set(L1[:3])) == 3 and L1[3] in L1[:3]
    assert [s[2] for s in o[:4]] == ['MISS', 'MISS', 'MISS', 'hit']

    # Beat 2's fork, step 5. The three options and the step each comes back on,
    # which is what the per-option feedback quotes: page 1 at step 6 (so
    # dropping it fetches it straight back), page 2 at step 8, page 3 at 10.
    assert dec[0][1] == {1: 6, 2: 8, 3: 10}
    assert dec[0][2] == 3
    assert min(dec[0][1], key=dec[0][1].get) == 1             # the worst pick is the next request

    # Beat 3 opens on what that one choice bought: steps 6 to 9 are four hits.
    assert all(s[2] == 'hit' for s in o[5:9])

    # Beat 3's fork, step 10. Page 1 is never requested again, which is why the
    # copy calls it the easiest call the learner will ever make, and why this
    # second decision needs no pointer at the evidence the way the first does.
    assert dec[1][1] == {1: None, 2: 11, 4: 13}
    assert dec[1][2] == 1
    assert 1 not in L1[10:]

    # Beat 4 opens on the finished tape: four more hits, and it ends on 5.
    assert all(s[2] == 'hit' for s in o[10:])
    assert sum(1 for s in o if s[2] == 'MISS') == 5

    # Refusing a wrong tap is the only instruction of method on the screen, and
    # it is only honest because the refusal can quote a checkable fact rather
    # than a hint. Every option at both forks has one: a step number, or the
    # fact that the page never returns.
    for step, opts, _ in dec:
        assert len(opts) == 3
        assert all(v is None or v > step for v in opts.values())

    # Beat 4 proves the floor instead of asserting it, and the proof is two
    # facts. Four pages each have to enter once. Then page 4 arrives at step 5
    # with 1, 2 and 3 resident and every one of them is requested again, so
    # whichever leaves comes back: five is a bound before it is a score.
    fa = floor_argument(L1, 3)
    assert fa['first_uses'] == {1: 1, 2: 2, 3: 3, 4: 5}
    assert fa['unavoidable'] == 4
    assert fa['forced_step'] == 5 and fa['forced_request'] == 4
    assert set(fa['resident']) == {1, 2, 3}
    assert fa['resident_next_use'] == {1: 6, 2: 8, 3: 10}
    assert fa['at_least'] == 5 == fa['achieved'] == opt(L1, 3)
    # The screen only calls the bound a floor because the learner reached it.
    # On any tape a lower bound that exceeded the optimum would be a wrong
    # argument stated confidently, which is the one thing a proof may not be.
    for r in (L1, L2, L3, BELADY):
        assert floor_argument(r, 3)['at_least'] <= opt(r, 3)

    # Level 2 — act 3 isolates which signal from the past is most useful.
    # Revised 31 Aug 2026: LRU must win clearly among the practical past-only
    # rules, while OPT remains exactly one fault lower. That keeps the lessons
    # separate: act 3 earns recency; act 4 earns perfect future knowledge.
    assert (fifo(L2, 3), lru(L2, 3), lfu(L2, 3), opt(L2, 3)) == (9, 7, 9, 6)
    assert lru(L2, 3) == opt(L2, 3) + 1
    assert fifo(L2, 3) - lru(L2, 3) == 2
    assert lfu(L2, 3) - lru(L2, 3) == 2

    # The first real decision is deliberately diagnostic. The same three
    # resident pages produce three different victims depending on what part of
    # the past you trust: arrival order -> 1, recency -> 2, frequency -> 3.
    fork = first_signal_fork(L2, 3)
    assert fork['step'] == 7 and fork['request'] == 4
    assert set(fork['mem']) == {1, 2, 3}
    assert (fork['fifo'], fork['lru'], fork['lfu']) == (1, 2, 3)

    # The consequence is readable after the fact without any tutor invention:
    # LRU's victim (2) never returns, while FIFO's and LFU's victims return at
    # steps 9 and 10. The learner can therefore receive specific credit/regret.
    assert fork['next_use'] == {1: 9, 2: None, 3: 10}
    l2_lru_log, l2_lru_credit = run_log(L2, 3, 'lru')
    assert l2_lru_log[6][3] == 2
    assert 2 in l2_lru_credit

    # LFU no longer needs a hidden tie-break. The old L2 did, which muddied the
    # experiment because two reasonable readings of "least frequent" scored
    # differently. On this tape both tie-breaks give the same result, with no
    # tied LFU eviction at all.
    assert lfu_ties(L2, 3) == 0
    assert lfu_by_arrival(L2, 3) == lfu(L2, 3) == 9

    # Random remains only a diagnostic, not a teaching comparison. Act 3's
    # scoreboard compares the three explicit signals and nothing else.
    assert 7.7 < rand_avg(L2, 3) < 8.5

    # Level 3 — clock == LRU, and the two natural near-misses both score 9
    assert (fifo(L3, 3), lru(L3, 3), clock(L3, 3), opt(L3, 3)) == (11, 8, 8, 7)
    assert clock_nohand(L3, 3) == 9 and clear_all(L3, 3) == 9

    # Belady — on the learner's OWN rule (clock), not FIFO
    assert (clock(BELADY, 3), clock(BELADY, 4)) == (9, 10)
    assert (fifo(BELADY, 3), fifo(BELADY, 4)) == (9, 10)
    assert (lru(BELADY, 3), lru(BELADY, 4)) == (10, 8)
    assert (opt(BELADY, 3), opt(BELADY, 4)) == (7, 6)
    assert leak_steps(trace_clock, BELADY, 3, 4) == [7, 8, 11]
    assert leak_steps(trace_fifo, BELADY, 3, 4) == [7, 8, 11]
    assert leak_steps(trace_lru, BELADY, 3, 4) == []
    a, b = trace_clock(BELADY, 3), trace_clock(BELADY, 4)
    assert a[6] == {1, 2, 5} and b[6] == {2, 3, 4, 5}        # the leak at step 7: page 1

    # --- act 4's instrument: the floor beside every score in the second half.
    # The act claims a gap column, and the second half prints it on three
    # result cards, so it is asserted here rather than believed.
    assert opt(L1, 3) - opt(L1, 3) == 0                       # screen 8, the learner plays the floor
    assert lru(L2, 3) - opt(L2, 3) == 1                       # screen 7/8, recency is one off
    assert clock(L3, 3) - opt(L3, 3) == 1                     # screen 10, one bit is one off
    assert clock(BELADY, 3) - opt(BELADY, 3) == 2             # screen 11, three frames
    assert clock(BELADY, 4) - opt(BELADY, 4) == 4             # screen 11, four frames
    # And the sentence screen 11 says out loud: the extra frame moved the floor
    # down by one and the learner's own rule up by one, at the same time.
    assert opt(BELADY, 4) == opt(BELADY, 3) - 1
    assert clock(BELADY, 4) == clock(BELADY, 3) + 1
    print('all lesson invariants verified')

if __name__ == '__main__':
    verify()
