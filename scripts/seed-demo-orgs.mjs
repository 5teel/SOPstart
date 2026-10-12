// Demo sites (2026-10-11): renames the real org to Visy and seeds three switchable demo orgs,
// each with departments, 5-13 dummy people (example.com addresses, no password, never emailed)
// and starter SOPs. Simon and eval-admin are the only admins of the three. Idempotent: keyed on
// org name, department name, user email and SOP number. Steps are written by
// `npx tsx scripts/convert-sops-to-steps.ts --missing --org <id>` after this runs.
// Run: node scripts/seed-demo-orgs.mjs
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '') }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const must = ({ data, error }) => { if (error) throw error; return data }

const VISY_ID = 'bd2c2b88-b26e-46ca-a6b4-a89161a98aea'
const ADMINS = ['simonscott86@gmail.com', 'eval-admin@sopstart.com']

// SOP: [number, title, status, hazards[], ppe[], steps[]]
const ORGS = [
  {
    name: 'Southern Rail Track Services', slug: 'southernrail',
    departments: [
      ['Track Renewal', 'TRK', [
        ['TRK-001', 'Sleeper replacement in a track possession', 'published', ['Moving trains on adjacent lines', 'Manual handling of 280 kg concrete sleepers'], ['Hi-vis vest', 'Safety boots', 'Hard hat', 'Gloves'], ['Confirm the possession is in place with the protection officer.', 'Remove the fastenings from the old sleeper.', 'Dig out the ballast to sleeper depth.', 'Drag the old sleeper clear with the sleeper grab.', 'Place the new sleeper and refit the fastenings.', 'Pack the ballast and record the sleeper count.']],
        ['TRK-002', 'Ballast regulating after tamping', 'draft', ['Rotating brushes on the regulator', 'Dust from dry ballast'], ['Hearing protection', 'Dust mask', 'Hi-vis vest'], ['Walk the section and mark obstructions.', 'Set the plough wings for the track profile.', 'Regulate at walking pace.', 'Check the shoulder width at every tenth sleeper.']],
        ['TRK-003', 'Track geometry hand check', 'published', ['Trains on adjacent lines'], ['Hi-vis vest', 'Safety boots'], ['Zero the track gauge on the reference bar.', 'Measure gauge and cant every 5 metres.', 'Record any reading outside tolerance.', 'Report faults to the track supervisor before leaving.']],
      ]],
      ['Signals & Comms', 'SIG', [
        ['SIG-001', 'Signal location case inspection', 'published', ['Live 110 V supply in the case', 'Trains on the adjacent line'], ['Insulated gloves', 'Hi-vis vest'], ['Get permission from the signaller.', 'Open the case and check the door seal.', 'Test the battery voltage.', 'Check terminations for heat damage.', 'Lock the case and sign the log card.']],
        ['SIG-002', 'Axle counter head replacement', 'draft', ['Trains on the line', 'Live signalling circuits'], ['Hi-vis vest', 'Safety boots', 'Gloves'], ['Confirm the section is blocked to traffic.', 'Disconnect the counter head cable.', 'Fit the new head at the set height.', 'Reset the section with the signaller.']],
      ]],
      ['Overhead Line', 'OHL', [
        ['OHL-001', 'Isolation and earthing of overhead line', 'published', ['25 kV overhead line', 'Induced voltage on parallel wires'], ['Insulated gloves', 'Hard hat', 'Hi-vis vest'], ['Receive the isolation permit from control.', 'Test for dead with the approved tester.', 'Fit earths at both ends of the work area.', 'Display the permit at the worksite.']],
        ['OHL-002', 'Dropper replacement from the work platform', 'draft', ['Working at height', 'Falling tools'], ['Harness', 'Hard hat', 'Gloves'], ['Check the earths are still fitted.', 'Clip on to the platform anchor.', 'Remove the damaged dropper.', 'Fit the new dropper and check the contact wire height.']],
      ]],
      ['Welding & Grinding', 'WLD', [
        ['WLD-001', 'Aluminothermic rail weld', 'published', ['Molten metal at 2,000 °C', 'Burns from the crucible'], ['Face shield', 'Leather apron', 'Welding gloves', 'Safety boots'], ['Cut the rail gap to 25 mm.', 'Align the rails with the straight edge.', 'Fit the moulds and seal with luting sand.', 'Preheat to the set time.', 'Ignite the portion and stand clear.', 'Trim and grind the weld to profile.']],
        ['WLD-002', 'Rail profile grinding', 'published', ['Sparks and hot fragments', 'Grinding noise'], ['Face shield', 'Hearing protection', 'Gloves'], ['Check the grinding wheel is undamaged.', 'Set the profile template.', 'Grind in light passes.', 'Check the profile with the template.']],
      ]],
      ['Plant & Fleet', 'PLT', [
        ['PLT-001', 'Hi-rail vehicle on-tracking', 'published', ['Vehicle rolling while on-tracking', 'Pinch points at the rail wheels'], ['Hi-vis vest', 'Safety boots'], ['Confirm the on-track point is protected.', 'Line the vehicle up square to the rails.', 'Lower the rail wheels.', 'Test the brakes on rail before moving off.']],
        ['PLT-002', 'Daily pre-start check: tamper', 'draft', ['Hydraulic fluid under pressure'], ['Gloves', 'Safety glasses'], ['Walk around and check for leaks.', 'Check the tamping tines for wear.', 'Test the horn and lights.', 'Record the check in the logbook.']],
      ]],
      ['Depot & Yard', 'DEP', [
        ['DEP-001', 'Stacking sleepers in the yard', 'published', ['Stack collapse', 'Forklift traffic'], ['Hi-vis vest', 'Safety boots', 'Gloves'], ['Check the ground is level and firm.', 'Place bearers under the first layer.', 'Stack no more than 10 high.', 'Tag the stack with the date and type.']],
      ]],
    ],
    people: [
      ['Aroha Ngata', 'supervisor', ['Track Renewal']], ['Ben Fairweather', 'worker', ['Track Renewal']], ['Hemi Walker', 'worker', ['Track Renewal']],
      ['Priya Nair', 'supervisor', ['Signals & Comms']], ['Tom Kerr', 'worker', ['Signals & Comms']], ['Liam O\'Connell', 'worker', ['Overhead Line']],
      ['Sione Taufa', 'worker', ['Welding & Grinding']], ['Grace Liu', 'safety_manager', []], ['Mike Henare', 'supervisor', ['Plant & Fleet', 'Depot & Yard']],
      ['Jess Thornton', 'worker', ['Plant & Fleet']], ['Wiremu Paki', 'worker', ['Depot & Yard']],
    ],
  },
  {
    name: 'Kōwhai Electrical Trades School', slug: 'kowhaitrades',
    departments: [
      ['Wiring Workshop', 'WIR', [
        ['WIR-001', 'Wiring a lighting circuit on the practice frame', 'published', ['Electric shock if the frame is powered', 'Cuts from cable strippers'], ['Safety glasses'], ['Check the frame is isolated and tagged.', 'Run the cable from the switch to the light.', 'Terminate at the switch and the ceiling rose.', 'Have the tutor check before power is applied.']],
        ['WIR-002', 'Running cable through a timber stud wall', 'published', ['Drill kickback', 'Wood dust'], ['Safety glasses', 'Dust mask'], ['Mark the cable route on the studs.', 'Drill each stud at the marked height.', 'Pull the cable through without twisting.', 'Fix the cable within 300 mm of each box.']],
        ['WIR-003', 'Fitting a power point', 'draft', ['Electric shock'], ['Safety glasses', 'Insulated gloves'], ['Test the circuit is dead.', 'Strip the conductors to length.', 'Terminate active, neutral and earth.', 'Fix the outlet and test polarity.']],
      ]],
      ['Switchboards', 'SWB', [
        ['SWB-001', 'Isolation and lock-out at a switchboard', 'published', ['Electric shock and arc flash'], ['Arc-rated face shield', 'Insulated gloves'], ['Identify the circuit on the board schedule.', 'Switch off and lock the breaker.', 'Fit your personal danger tag.', 'Test for dead at the point of work.']],
        ['SWB-002', 'Installing an RCD in a training board', 'draft', ['Electric shock'], ['Insulated gloves', 'Safety glasses'], ['Isolate the training board.', 'Clip the RCD onto the DIN rail.', 'Connect line and load conductors.', 'Press the test button after power-up.']],
      ]],
      ['Solar & Battery', 'SOL', [
        ['SOL-001', 'Isolating a grid-tied solar array', 'published', ['DC voltage from panels in daylight', 'Battery fault current'], ['Insulated gloves', 'Safety glasses'], ['Switch off the AC isolator.', 'Switch off the DC isolator at the inverter.', 'Cover the panels if work is on the array.', 'Test for dead on both AC and DC sides.']],
        ['SOL-002', 'Battery enclosure inspection', 'draft', ['Battery fault current', 'Hot surfaces'], ['Insulated gloves', 'Face shield'], ['Check the enclosure vents are clear.', 'Check for swelling or damage.', 'Record the state of charge.', 'Close and lock the enclosure.']],
      ]],
      ['Testing & Inspection', 'TST', [
        ['TST-001', 'Insulation resistance test', 'published', ['Test voltage on conductors'], ['Insulated gloves'], ['Isolate and prove dead.', 'Disconnect sensitive equipment.', 'Test between active, neutral and earth at 500 V.', 'Record each reading on the test sheet.']],
        ['TST-002', 'Earth continuity test', 'published', ['Electric shock if the circuit is live'], ['Insulated gloves'], ['Null the test leads.', 'Test from the main earth to each outlet.', 'Record readings over 1 ohm as a fault.']],
      ]],
      ['Industrial Controls', 'CTL', [
        ['CTL-001', 'Wiring a direct-on-line motor starter', 'draft', ['Electric shock', 'Rotating motor shaft'], ['Safety glasses', 'Insulated gloves'], ['Isolate the training bay.', 'Wire the control circuit to the contactor.', 'Wire the overload to the motor.', 'Test start and stop with the tutor present.']],
      ]],
    ],
    people: [
      ['Rangi Tuhoe', 'supervisor', ['Wiring Workshop', 'Switchboards']], ['Sarah Mitchell', 'supervisor', ['Solar & Battery', 'Testing & Inspection']],
      ['Jayden Brown', 'worker', ['Wiring Workshop']], ['Mia Patel', 'worker', ['Wiring Workshop']], ['Noah Tipene', 'worker', ['Switchboards']],
      ['Ella Robinson', 'worker', ['Solar & Battery']], ['Kauri Smith', 'worker', ['Industrial Controls']], ['Dan Whitaker', 'safety_manager', []],
    ],
  },
  {
    name: 'Clearwater Beverages', slug: 'clearwater',
    departments: [
      ['Water Treatment', 'WTR', [
        ['WTR-001', 'Backwashing the sand filter', 'published', ['Pressurised water lines', 'Slippery floor'], ['Safety glasses', 'Safety boots'], ['Close the inlet valve.', 'Open the backwash valve.', 'Run the backwash until the sight glass is clear.', 'Return valves to service and record the time.']],
        ['WTR-002', 'Chlorine dosing check', 'published', ['Chlorine solution splash'], ['Chemical goggles', 'Chemical gloves', 'Apron'], ['Take a sample from the test point.', 'Test free chlorine with the meter.', 'Adjust the dosing pump if outside 1 to 2 ppm.', 'Record the result.']],
      ]],
      ['Syrup Room', 'SYR', [
        ['SYR-001', 'Batching a syrup tank', 'published', ['Manual handling of 25 kg bags', 'Hot water at 80 °C'], ['Gloves', 'Hairnet', 'Safety boots'], ['Check the batch sheet and the tank is clean.', 'Add water to the start level.', 'Add sugar with the agitator running.', 'Add flavour concentrate in the set order.', 'Take a Brix sample for the lab.']],
        ['SYR-002', 'CIP of a syrup tank', 'draft', ['Caustic solution', 'Hot surfaces'], ['Chemical goggles', 'Chemical gloves', 'Apron'], ['Confirm the tank is empty and isolated.', 'Start the CIP programme.', 'Check caustic concentration at the return.', 'Verify the final rinse with pH paper.']],
      ]],
      ['Blow Moulding', 'BLW', [
        ['BLW-001', 'Preform hopper top-up', 'published', ['Moving elevator belt'], ['Gloves', 'Hearing protection'], ['Check the preform batch matches the work order.', 'Tip the octabin with the bin tipper.', 'Keep hands clear of the elevator.', 'Record the batch number.']],
        ['BLW-002', 'Mould changeover', 'draft', ['Stored energy in the mould carrier', 'Hot moulds'], ['Heat-resistant gloves', 'Safety glasses'], ['Lock out the blow moulder.', 'Release mould carrier pressure.', 'Swap the mould halves.', 'Run 20 test bottles and check the base.']],
      ]],
      ['Filling Line', 'FIL', [
        ['FIL-001', 'Clearing a jam at the filler infeed', 'published', ['Moving star wheels', 'Broken bottle edges'], ['Gloves', 'Safety glasses'], ['Stop the line and press the e-stop.', 'Open the guard only after the star wheel stops.', 'Clear the jammed bottles.', 'Close the guard and reset.']],
        ['FIL-002', 'Fill-height check', 'published', ['Moving conveyor'], ['Hairnet', 'Safety glasses'], ['Take 5 bottles after the capper.', 'Measure fill height with the gauge.', 'Adjust the filler if any reading is out.', 'Record results on the line sheet.']],
        ['FIL-003', 'Capper torque check', 'draft', ['Rotating capping heads'], ['Gloves'], ['Take 3 bottles from each head.', 'Test removal torque.', 'Report heads outside range to the fitter.']],
      ]],
      ['Packing & Palletising', 'PAK', [
        ['PAK-001', 'Changing the shrink film roll', 'published', ['Hot sealing bar', 'Heavy film roll'], ['Heat-resistant gloves', 'Safety boots'], ['Stop the shrink wrapper and wait for the bar to cool.', 'Lift the empty core out.', 'Load the new roll with the lifter.', 'Thread the film and splice the ends.']],
        ['PAK-002', 'Palletiser fault reset', 'draft', ['Moving robot arm', 'Falling packs'], ['Hard hat', 'Safety boots'], ['Stop the palletiser at the panel.', 'Enter only through the interlocked gate.', 'Clear fallen packs.', 'Exit and reset from the panel.']],
      ]],
      ['Warehouse', 'WHS', [
        ['WHS-001', 'Forklift pre-start check', 'published', ['Pedestrians in aisles', 'Load falling from forks'], ['Hi-vis vest', 'Safety boots'], ['Check tyres, forks and chains.', 'Test the horn, lights and brakes.', 'Check the seatbelt works.', 'Record the check on the tablet.']],
      ]],
    ],
    people: [
      ['Kate Henderson', 'supervisor', ['Filling Line', 'Blow Moulding']], ['Tama Rewi', 'supervisor', ['Packing & Palletising', 'Warehouse']],
      ['Olivia Chen', 'worker', ['Syrup Room']], ['Josh Parata', 'worker', ['Filling Line']], ['Ana Fonoti', 'worker', ['Filling Line']],
      ['Ryan McKay', 'worker', ['Blow Moulding']], ['Zoe Williams', 'worker', ['Water Treatment']], ['Ihaia Moana', 'worker', ['Warehouse']],
      ['Hannah Scott', 'worker', ['Packing & Palletising']], ['Craig Dunn', 'safety_manager', []], ['Lucy Tane', 'worker', ['Syrup Room', 'Water Treatment']],
      ['Pita Hohaia', 'worker', ['Warehouse']], ['Emma Rowe', 'supervisor', ['Syrup Room', 'Water Treatment']],
    ],
  },
]

// --- Visy keeps everything to date ---
must(await sb.from('organisations').update({ name: 'Visy' }).eq('id', VISY_ID).select('id'))
console.log('renamed', VISY_ID, '-> Visy')

const users = must(await sb.auth.admin.listUsers({ perPage: 1000 })).users
const byEmail = new Map(users.map((u) => [u.email, u]))
const adminIds = ADMINS.map((e) => { const u = byEmail.get(e); if (!u) throw new Error(`missing ${e}`); return u.id })

// Pin both admins to Visy so joining three more orgs does not move their sign-in (the hook falls back to the newest membership).
for (const id of adminIds) {
  const u = users.find((x) => x.id === id)
  if (u.user_metadata?.active_org_id) continue
  must(await sb.auth.admin.updateUserById(id, { user_metadata: { ...u.user_metadata, active_org_id: VISY_ID } }))
}

const kinds = must(await sb.from('section_kinds').select('id, slug, display_name').in('slug', ['hazards', 'ppe', 'steps']))
const kind = Object.fromEntries(kinds.map((k) => [k.slug, k]))

for (const o of ORGS) {
  let org = must(await sb.from('organisations').select('id').eq('name', o.name).maybeSingle())
  if (!org) org = must(await sb.from('organisations').insert({ name: o.name }).select('id').single())
  if (org.id === VISY_ID) throw new Error('collides with Visy')
  console.log(o.name, org.id)

  for (const id of adminIds) must(await sb.from('organisation_members').upsert({ organisation_id: org.id, user_id: id, role: 'admin' }, { onConflict: 'organisation_id,user_id' }).select('id'))

  const deptId = {}
  for (const [name, code] of o.departments) {
    let d = must(await sb.from('departments').select('id').eq('organisation_id', org.id).eq('name', name).maybeSingle())
    if (!d) d = must(await sb.from('departments').insert({ organisation_id: org.id, name, code }).select('id').single())
    deptId[name] = d.id
  }

  const ids = {}
  for (const [full, role, depts] of o.people) {
    const email = `${full.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.')}@${o.slug}.example.com`
    let u = byEmail.get(email)
    if (u && u.user_metadata?.demo_fixture !== true) throw new Error(`${email} exists and is not a demo fixture`)
    if (!u) u = must(await sb.auth.admin.createUser({ email, email_confirm: true, user_metadata: { demo_fixture: true, full_name: full, active_org_id: org.id } })).user
    ids[full] = u.id
    must(await sb.from('organisation_members').upsert({ organisation_id: org.id, user_id: u.id, role }, { onConflict: 'organisation_id,user_id' }).select('id'))
    for (const d of depts) must(await sb.from('member_departments').upsert({ member_id: u.id, department_id: deptId[d] }, { onConflict: 'member_id,department_id' }))
  }

  // Each supervisor signs off the workers who share a department with them.
  for (const [sup, role, sd] of o.people) {
    if (role !== 'supervisor') continue
    for (const [w, wr, wd] of o.people) {
      if (wr !== 'worker' || !wd.some((d) => sd.includes(d))) continue
      must(await sb.from('supervisor_assignments').upsert({ organisation_id: org.id, supervisor_id: ids[sup], worker_id: ids[w] }, { onConflict: 'organisation_id,supervisor_id,worker_id' }))
    }
  }

  for (const [dname, , sops] of o.departments) {
    for (const [num, title, status, hazards, ppe, steps] of sops) {
      if (must(await sb.from('sops').select('id').eq('organisation_id', org.id).eq('sop_number', num).maybeSingle())) continue
      const now = new Date().toISOString()
      const sop = must(await sb.from('sops').insert({
        organisation_id: org.id, title, sop_number: num, status, source_type: 'blank', uploaded_by: adminIds[0],
        source_file_name: `${num}.docx`, source_file_type: 'docx', source_file_path: '', department: dname,
        published_at: status === 'published' ? now : null, owner_user_id: adminIds[0],
      }).select('id').single())
      must(await sb.from('sop_departments').insert({ sop_id: sop.id, department_id: deptId[dname] }))
      const secs = must(await sb.from('sop_sections').insert([
        { sop_id: sop.id, section_kind_id: kind.hazards.id, section_type: 'hazards', title: kind.hazards.display_name, content: hazards.map((h) => `• ${h}`).join('\n'), sort_order: 0, approved: true },
        { sop_id: sop.id, section_kind_id: kind.ppe.id, section_type: 'ppe', title: kind.ppe.display_name, content: ppe.map((p) => `• ${p}`).join('\n'), sort_order: 1, approved: true },
        { sop_id: sop.id, section_kind_id: kind.steps.id, section_type: 'steps', title: kind.steps.display_name, content: null, sort_order: 2, approved: true },
      ]).select('id, section_type'))
      const stepSec = secs.find((s) => s.section_type === 'steps').id
      must(await sb.from('sop_steps').insert(steps.map((text, i) => ({ section_id: stepSec, step_number: i + 1, text }))))
    }
  }
  console.log(`  ${o.people.length} people, ${o.departments.reduce((n, d) => n + d[2].length, 0)} SOPs`)
}

// --- Machines: the map draws a SOP by its first machine's name (tank, conveyor, rack ...); no machine = noticeboard ---
const MACHINES = {
  'TRK-001': 'Sleeper rack', 'TRK-002': 'Ballast regulator', 'SIG-001': 'Signal location case', 'SIG-002': 'Axle counter',
  'OHL-001': 'OHL mast', 'OHL-002': 'Work platform truck', 'WLD-001': 'Weld bench', 'WLD-002': 'Rail grinder',
  'PLT-001': 'Hi-rail truck', 'PLT-002': 'Tamper', 'DEP-001': 'Sleeper stack rack',
  'WIR-001': 'Wiring bench', 'WIR-002': 'Wiring bench', 'SWB-001': 'Main switchboard', 'SWB-002': 'Training switchboard',
  'SOL-001': 'Inverter', 'SOL-002': 'Battery enclosure', 'TST-001': 'Test lab bench', 'TST-002': 'Test lab bench', 'CTL-001': 'Motor starter panel',
  'WTR-001': 'Sand filter tank', 'WTR-002': 'Chlorine dosing tank', 'SYR-001': 'Syrup tank 1', 'SYR-002': 'Syrup tank 1',
  'BLW-001': 'Preform hopper', 'BLW-002': 'Blow moulder', 'FIL-001': 'Filler infeed conveyor', 'FIL-002': 'Filler', 'FIL-003': 'Capper',
  'PAK-001': 'Shrink wrapper', 'PAK-002': 'Palletiser', 'WHS-001': 'Forklift',
}
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const code = () => [...globalThis.crypto.getRandomValues(new Uint8Array(6))].map((x) => ALPHABET[x % 32]).join('')
for (const o of ORGS) {
  const org = must(await sb.from('organisations').select('id').eq('name', o.name).single())
  let layout = must(await sb.from('site_layouts').select('id').eq('organisation_id', org.id).limit(1).maybeSingle())
  if (!layout) layout = must(await sb.from('site_layouts').insert({ organisation_id: org.id, name: 'Main site' }).select('id').single())
  const depts = Object.fromEntries(must(await sb.from('departments').select('id, name').eq('organisation_id', org.id)).map((d) => [d.name, d.id]))
  const have = Object.fromEntries(must(await sb.from('site_machines').select('id, name').eq('site_layout_id', layout.id)).map((m) => [m.name, m.id]))
  let sort = 0, n = 0
  for (const [dname, , sops] of o.departments) {
    for (const [num] of sops) {
      const name = MACHINES[num]
      if (!name) continue
      if (!have[name]) have[name] = must(await sb.from('site_machines').insert({ site_layout_id: layout.id, organisation_id: org.id, name, department_id: depts[dname], polygon: [[0, 0], [1, 0], [1, 1]], code: code(), sort: sort++ }).select('id').single()).id
      const sop = must(await sb.from('sops').select('id').eq('organisation_id', org.id).eq('sop_number', num).single())
      must(await sb.from('sop_machines').upsert({ sop_id: sop.id, machine_id: have[name], organisation_id: org.id }, { onConflict: 'sop_id,machine_id', ignoreDuplicates: true }))
      n++
    }
  }
  console.log(o.name, 'machine links', n)
}

// ADR-0010: tiers. Some departments sit inside a parent area on the site map; Kōwhai stays flat.
const TIERS = {
  southernrail: { 'Corridor Works': ['CWK', ['Track Renewal', 'Welding & Grinding', 'Overhead Line', 'Signals & Comms']], Depot: ['DPO', ['Depot & Yard', 'Plant & Fleet']] },
  clearwater: { 'Production Hall': ['PRH', ['Blow Moulding', 'Filling Line', 'Packing & Palletising']], Utilities: ['UTL', ['Water Treatment', 'Syrup Room']] },
}
for (const o of ORGS) {
  const tiers = TIERS[o.slug]
  if (!tiers) continue
  const org = must(await sb.from('organisations').select('id').eq('name', o.name).single())
  for (const [parent, [code, children]] of Object.entries(tiers)) {
    let p = must(await sb.from('departments').select('id').eq('organisation_id', org.id).eq('name', parent).maybeSingle())
    if (!p) p = must(await sb.from('departments').insert({ organisation_id: org.id, name: parent, code }).select('id').single())
    must(await sb.from('departments').update({ parent_id: p.id }).eq('organisation_id', org.id).in('name', children).select('id'))
  }
  console.log(o.name, 'tiers', Object.keys(tiers).join(', '))
}
