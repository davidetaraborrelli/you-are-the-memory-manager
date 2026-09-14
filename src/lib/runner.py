"""The screen 10 harness, executed in Pyodide's worker and in Python tests.

Only the three whitelisted tokens enter exec. A trace budget bounds learner
code; a separate main-thread deadline can terminate the entire worker.
"""
import json
import sys

SCAFFOLD = '''def evict(frames, bits, state):
    cursor = state.get("cursor", 0)
    while bits[cursor] == {condition}:
        bits[cursor] = {clear}
        cursor = next_slot(cursor)
    victim = {victim}
    state["cursor"] = next_slot(victim)
    return victim, bits
'''


class StepLimit(Exception):
    pass


class ObservedBits(list):
    def __init__(self, values):
        super().__init__(values)
        self.actions = []

    def __getitem__(self, slot):
        bit = super().__getitem__(slot)
        self.actions.append({'kind': 'inspect', 'slot': slot, 'before': bit})
        return bit

    def __setitem__(self, slot, value):
        before = super().__getitem__(slot)
        super().__setitem__(slot, value)
        self.actions.append({'kind': 'write', 'slot': slot, 'before': before, 'after': value})


def execute_rule(fields, spec):
    fields = [s.strip() for s in fields]
    if len(fields) != 3:
        return {'status': 'technical', 'message': 'Complete the three blanks.'}
    for i, value in enumerate(fields):
        if value not in (('0', '1') if i < 2 else ('cursor',)):
            return {'status': 'technical', 'field': i,
                    'message': 'Type one bit: 0 or 1.' if i < 2 else 'Use the variable that names the current slot.'}
    frames, bits = list(spec['initialFrames']), list(spec['initialBits'])
    n, state, records = len(frames), {}, []
    namespace = {'next_slot': lambda slot: (slot + 1) % n}
    source = SCAFFOLD.format(condition=fields[0], clear=fields[1], victim=fields[2])
    exec(compile(source, '<learner>', 'exec'), namespace)
    evict = namespace['evict']
    for i, page in enumerate(spec['ref']):
        hand_before, actions, returned_bits, victim = state.get('cursor', 0), [], None, None
        if page in frames:
            outcome, slot = 'hit', frames.index(page)
        elif None in frames:
            outcome, slot = 'fill', frames.index(None)
        else:
            outcome, tracked, budget = 'evict', ObservedBits(bits), 0

            def limit(frame, event, arg):
                nonlocal budget
                if frame.f_code.co_filename == '<learner>' and event == 'line':
                    budget += 1
                    if budget > 2048:
                        raise StepLimit()
                return limit

            previous_trace = sys.gettrace()
            try:
                sys.settrace(limit)
                slot, result_bits = evict(list(frames), tracked, state)
            except StepLimit:
                return {'status': 'technical', 'field': 1,
                        'message': 'That never came back. You were waiting for a bit to change, and nothing changes it but you. Check the second blank.'}
            except (IndexError, TypeError, ValueError, NameError):
                return {'status': 'technical', 'field': 2,
                        'message': 'The rule needs to return a slot in this memory and one bit per page.'}
            finally:
                sys.settrace(previous_trace)
            if type(slot) is not int or not 0 <= slot < n:
                return {'status': 'technical', 'field': 2, 'message': 'The victim must be a slot in this memory.'}
            if not isinstance(result_bits, list) or len(result_bits) != n or any(type(b) is not int or b not in (0, 1) for b in result_bits):
                return {'status': 'technical', 'field': 1, 'message': 'Return one bit, 0 or 1, for each page.'}
            actions, bits = tracked.actions, list(result_bits)
            returned_bits, victim = list(bits), frames[slot]
        frames[slot], bits[slot] = page, 1
        event = {'step': i + 1, 'page': page, 'outcome': outcome, 'slot': slot,
                 'victim': victim, 'frames': list(frames), 'bits': list(bits),
                 'handBefore': hand_before, 'handAfter': state.get('cursor', 0),
                 'scanned': [a['slot'] for a in actions if a['kind'] == 'inspect'],
                 'actions': actions}
        if returned_bits is not None:
            event['returnedBits'] = returned_bits
        records.append(event)
        expected = spec['steps'][i]
        if outcome == 'evict':
            expected_return = list(expected['bits'])
            expected_return[expected['slot']] = 0
            if slot != expected['slot']:
                message = f"Your rule removed page {victim} here. The rule we're building gives it another chance, clears its bit, and keeps looking."
            elif returned_bits != expected_return:
                message = 'The victim matches, but the bits differ. Watch which evidence your rule clears before it stops.'
            elif event['handBefore'] != expected['handBefore'] or event['handAfter'] != expected['handAfter']:
                message = 'The search must resume after the previous victim. Watch the position remembered between these choices.'
            else:
                message = None
            if message:
                return {'status': 'different', 'records': records, 'differenceStep': i + 1, 'message': message}
    return {'status': 'passed', 'records': records}


def run_request(payload):
    request = json.loads(payload)
    return json.dumps(execute_rule(request['fields'], request['spec']))
