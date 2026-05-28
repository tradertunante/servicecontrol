const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const POSTS = [
  {
    id: '3675fd04-0e3b-81de-9610-c990fcc56eb8',
    titulo: '5 roles. One source of truth.',
    copy: `5 roles. One source of truth.

A hotel has 5 types of people who each need different information.

The auditor needs to know what to check and where.
The manager needs to know what their team should fix.
The Quality Director needs to know which areas are at risk.
The General Manager needs to know if problems are actually getting resolved.
The IT team needs everything to work without paper.

With Excel and WhatsApp, everyone is working from a different version of reality.
Nobody is lying. Nobody is failing. There's just no system connecting them.

With ServiceControl, each role sees exactly what they need — in real time, from one platform.

5 roles. One system. One version of the truth.

Start your free trial:
→ servicecontrol.io/trial

#HotelOperations #HospitalityTech #HotelManagement #QualityManagement #OperationalExcellence`,
  },
  {
    id: '3675fd04-0e3b-8128-a6c7-c09686d7f3c4',
    titulo: "You've been auditing the same problems for months.",
    copy: `You've been auditing the same problems for months.

It's not your team. It's your system.

Finding a deviation without assigning it, dating it, and verifying it is exactly the same as not finding it at all.
The report exists. So does the problem.

ServiceControl turns every finding into a real action.
With an owner. With a deadline. With automatic verification.

Your team knows what needs doing.
Leadership knows if it got done.

No Excel. No WhatsApp.

Free trial — start today:
→ servicecontrol.io/trial

#HotelOperations #HospitalityTech #HotelQuality #CorrectiveActions #HotelManagement`,
  },
  {
    id: '3665fd04-0e3b-81a7-9a16-d62b2cb5df3b',
    titulo: 'The cycle that actually closes the problem.',
    copy: `Most hotels only have the first step.

They detect the problem.
Then it stops.

No step two. No step three.
The deviation lives somewhere in a WhatsApp message from three weeks ago.
And in the department — nothing's changed.

ServiceControl closes the full loop:

→ Detect — Mobile audit with photo evidence. Automatic score by area. No paper.
→ Correct — Corrective action with a responsible party and deadline, assigned on the spot. The manager sees it in real time.
→ Verify — Automatic re-audit confirms the fix was real, not assumed.

Three steps. One system. No WhatsApp. No forgotten issues. No surprises.

Free trial:
→ servicecontrol.io/trial

#HotelOperations #HospitalityTech #HotelQuality #AuditManagement #OperationalExcellence`,
  },
  {
    id: '3665fd04-0e3b-8119-8974-f1023ea0ac48',
    titulo: 'Introducing ServiceControl',
    copy: `How many operational problems at your hotel are caught too late?

Most hotel operations teams still run on paper checklists, Excel spreadsheets, or WhatsApp groups. The result: untracked incidents, inconsistent audits, and reactive management instead of preventive.

Introducing ServiceControl — the SaaS platform built specifically for operational auditing in hotels.

With ServiceControl you can:

✅ Build custom audit templates by department (rooms, restaurant, maintenance, reception…)
✅ Run audits from any device, online or offline
✅ Detect deviations in real time and assign corrective actions instantly
✅ Track re-audits until every issue is actually closed
✅ Access analytics and reports to make data-driven decisions

All in one place, with role-based access for auditors, managers, general management, and admins.

The result: fewer recurring issues, more consistency, and a culture of continuous improvement across every department.

If you manage hotel operations and want to move beyond paper and Excel — ServiceControl is for you.

→ Early access coming soon. Interested? Send us a message.

#HotelOperations #HospitalityTech #HotelManagement #OperationalExcellence #QualityManagement`,
  },
  {
    id: '3665fd04-0e3b-8177-982a-ea2c560418a9',
    titulo: "Launch: The problem isn't your team.",
    copy: `The problem isn't that your team doesn't fix things.
It's that nobody knows what's still pending.

The deviation gets detected. Someone sends it on WhatsApp. That's where it dies.

No owner. No deadline. No verification.
The problem doesn't get resolved — it gets normalized.

That's how operational quality works in most hotels.
Until something goes wrong in front of a guest. Or during a brand audit.

ServiceControl changes that.

Every finding creates a corrective action with a name, priority, and deadline. An automatic re-audit verifies it's actually closed. The executive dashboard shows everything in real time — no chasing updates.

We're live today.
Free trial — start now:
→ servicecontrol.app/trial

#HotelOperations #HospitalityTech #HotelQuality #CorrectiveActions #Launch`,
  },
  {
    id: '3655fd04-0e3b-81dd-a72d-f17921f51286',
    titulo: "Your hotel's biggest operational risk isn't the competition.",
    copy: `Your hotel's biggest operational risk isn't the competition.

It's the audit spreadsheet nobody updates.

The hotel groups with the best guest experience control don't have more rigorous auditors.

They have better systems.

When an incident is logged, assigned, and given a close date — it disappears. When it lives in a Word doc or a WhatsApp thread — it comes back in every audit.

We built ServiceControl working directly with hotel operations teams to digitize this process: area templates, mobile execution, corrective action tracking, and automated reports.

If you're a GM, Operations Director, or Quality Director and want to see how other hotels are doing it — send us a message.

20 minutes. No commitment.

#HotelOperations #HospitalityTech #HotelManagement #QualityManagement #Hospitality`,
  },
  {
    id: '3655fd04-0e3b-81cf-8d2c-d833631d04df',
    titulo: 'How many corrective actions from your last audit are still open?',
    copy: `How many corrective actions from your last audit are still open?

Not a rhetorical question.

Most hotels we've audited follow the same pattern:

→ The auditor walks the property with paper, Excel, or photos on WhatsApp
→ A report gets written — hours later
→ Tasks are assigned verbally or by message
→ In the next audit... the same problems appear

It's not a lack of diligence. It's a lack of system.

That's why we built ServiceControl. An operational auditing platform designed specifically for hotels:

✓ Templates by area: rooms, restaurant, maintenance, reception…
✓ Auditor executes the round from mobile, with photos and evidence
✓ Corrective actions assigned, notified, and closed with full traceability
✓ Automatic reports for management — zero manual work
✓ Historical data by area to identify real recurring patterns

If you manage operations or quality at a hotel and want to see how it works, we can give you a 20-minute demo this week.

Send us a message or drop a comment and we'll reach out.

#HotelOperations #HospitalityTech #Hospitality #HotelManagement #AuditManagement`,
  },
  {
    id: '3655fd04-0e3b-8173-a33e-c3858f19802a',
    titulo: 'Looking for 3 hotels for a free demo.',
    copy: `Looking for 3 hotels for a free ServiceControl demo.

Not a generic demo. A 20-minute session built around your areas, your checklists, and your real workflow.

Why only 3?
Because we want to take the time to understand each operation before the call. This isn't a contact form. It's a real conversation.

What kind of hotel?
→ 50 to 500 rooms
→ Active operations or quality team
→ Running internal audits regularly (even if it's still on paper or Excel)

What you'll see in the demo:
✓ How area templates are configured
✓ How the auditor runs their round from mobile
✓ How corrective actions are managed with full traceability
✓ How the automatic report is generated for management

No commitment. No sales pitch. Just 20 minutes to see if it makes sense for you.

Interested? Send us a message or drop a comment with your email and we'll reach out this week.

#HotelOperations #HospitalityTech #Hospitality #HotelManagement #Demo`,
  },
  {
    id: '3655fd04-0e3b-8146-833d-ca5aaca86ba4',
    titulo: 'From paper checklist to automated report.',
    copy: `From paper checklist to automated report. This is what an audit looks like at a hotel running ServiceControl.

Monday. 9:00 AM. The auditor starts the rooms round.

Before:
Printed checklist in hand. Notes written by hand. If there's an incident — photo to the WhatsApp group. Midday: enters everything into Excel. 5 PM: sends the report to management. Management reads it Tuesday.

With ServiceControl:
The auditor opens the app. Selects area: rooms, floor 3. Runs the checklist. Detects an issue in bathroom 312 — photo, description, assigned to maintenance, 24-hour deadline.

Round complete by 11 AM. Report already generated. Management gets a notification at 11:15 AM.

Maintenance receives the corrective action in their dashboard. Closes it with photo evidence by 2 PM.

In the next audit, the system already shows whether it was resolved.

Same work. Different system.

Want to see it in 20 minutes? Send us a message.

#HotelOperations #HospitalityTech #Hospitality #AuditManagement #HotelManagement`,
  },
  {
    id: '3655fd04-0e3b-81e1-a8d1-e5a077549d9c',
    titulo: 'How many hours does your team spend writing audit reports each month?',
    copy: `How many hours does your team spend writing audit reports each month?

Count everything:
→ Transferring notes from paper to Excel
→ Reviewing and organizing photos from mobile
→ Writing the management report
→ Preparing the pending corrective actions summary
→ Updating last week's follow-up

In most hotels we've spoken with, that's 6 to 12 hours per auditor per month.

That's not audit time. That's admin time.

The issue isn't the team's dedication. It's that the system forces them to manually document what should be recorded automatically.

With ServiceControl, the report generates itself when the round ends. The auditor executes. The system documents.

The hours recovered go back into running more rounds, closing more corrective actions, or simply not working weekends.

Want to see how it works in practice? We can give you a 20-minute demo this week.

Send us a message.

#HotelOperations #HospitalityTech #Hospitality #HotelManagement #OperationalExcellence`,
  },
  {
    id: '3655fd04-0e3b-8167-90c7-c31ec89c429b',
    titulo: "3 signs your hotel's audit system is broken.",
    copy: `3 signs your hotel's audit system is broken.

Not the audit results. The system itself.

Sign 1: The same issues appear in every audit
If the same problem has been in the report for three quarters, it's not an operations problem. It's a follow-up problem. Corrective actions aren't actually closing.

Sign 2: Writing the report takes longer than running the audit
If your team spends 2-3 hours documenting what took 1 hour to inspect, the process is inverted. The value is in detecting and resolving — not in writing it up.

Sign 3: Nobody knows exactly what was left open from the last round
If you're asking "did we close the maintenance issue on the third floor?" in every meeting — corrective actions don't have a real owner or deadline.

These three signs share the same root cause: a system that depends on people remembering things instead of tools managing the process.

That's why we built ServiceControl.

Recognize any of these at your hotel? Send us a message and let's talk.

#HotelOperations #HospitalityTech #HotelManagement #QualityManagement #Hospitality`,
  },
  {
    id: '3655fd04-0e3b-8139-8fa5-e94b6d824442',
    titulo: 'What changes when you stop managing hotel audits in Excel.',
    copy: `What changes when you stop managing hotel audits in Excel.

Before:
→ Auditor prints the checklist, fills it in by hand
→ End of day: transfers data to Excel
→ Someone writes the report (2-3 hours)
→ Corrective actions sent by email or WhatsApp
→ Next audit: nobody remembers what was left open

After:
→ Auditor runs the round from mobile
→ Incidents logged with photos in real time
→ Report generated automatically
→ Corrective actions assigned with owner and deadline
→ Next audit: the system shows what was closed and what wasn't

Same work. Different system.

The real difference isn't the time saved (which is significant). It's that problems stop repeating.

We're in pre-launch for ServiceControl and looking for hotels that want to be among the first to try it.

Interested in a 20-minute demo? Send us a message.

#HotelOperations #HospitalityTech #Hospitality #HotelManagement #QualityManagement`,
  },
  {
    id: '3655fd04-0e3b-8175-933a-fc934862b99e',
    titulo: 'How top-performing hotels digitize their audits.',
    copy: `How top-performing hotels digitize their audits.

It's not magic. It's process.

Hotels with the most controlled operations all do the same things:

1. Define templates by area
Each area has a standard checklist: rooms, restaurant, reception, maintenance. They don't improvise what to review each time.

2. Execute from mobile
The auditor carries a phone, not paper. Photo of the incident, description, affected area. Everything logged in real time.

3. Assign corrective actions on the spot
When a problem is detected, a responsible party and deadline are assigned before leaving the floor. Not in the afternoon report.

4. Generate automatic reports
Management receives a summary without anyone having to write it. Time saved on reports goes back into solving real problems.

5. Track historical data
Does this area always fail at the same point? The history shows it. You can get ahead of it before an inspection or a complaint.

This is what we're building with ServiceControl.

If you manage quality or operations at a hotel, we'd love to show you. 20-minute demo.

Send us a message.

#HotelOperations #HospitalityTech #HotelManagement #AuditManagement #QualityManagement`,
  },
  {
    id: '3655fd04-0e3b-81bf-8ade-d2ef182a58be',
    titulo: "Your hotel's biggest operational risk isn't the competition. (2)",
    copy: `Your hotel's biggest operational risk isn't the competition.

It's the audit spreadsheet nobody updates.

The hotel groups with the best guest experience control don't have more rigorous auditors.

They have better systems.

When an incident is logged, assigned, and given a close date — it disappears. When it lives in a Word doc or a WhatsApp thread — it comes back in every audit.

We built ServiceControl working directly with hotel operations teams to digitize this process: area templates, mobile execution, corrective action tracking, and automated reports.

If you're a GM, Operations Director, or Quality Director and want to see how other hotels are doing it — send us a message.

20 minutes. No commitment.

#HotelOperations #HospitalityTech #HotelManagement #QualityManagement #Hospitality`,
  },
  {
    id: '3655fd04-0e3b-812d-9a40-f95119463528',
    titulo: 'How many corrective actions from your last audit are still open? (2)',
    copy: `How many corrective actions from your last audit are still open?

Not a rhetorical question.

Most hotels we've audited follow the same pattern:

→ The auditor walks the property with paper, Excel, or photos on WhatsApp
→ A report gets written — hours later
→ Tasks are assigned verbally or by message
→ In the next audit... the same problems appear

It's not a lack of diligence. It's a lack of system.

That's why we built ServiceControl.

An operational auditing platform designed specifically for hotels:

✓ Templates by area: rooms, restaurant, maintenance, reception…
✓ Auditor executes the round from mobile, with photos and evidence
✓ Corrective actions assigned, notified, and closed with full traceability
✓ Automatic reports for management — zero manual work
✓ Historical data by area to identify real recurring patterns

If you manage operations or quality at a hotel and want to see how it works, we can give you a 20-minute demo this week.

Send us a message or drop a comment and we'll reach out.

#HotelOperations #HospitalityTech #Hospitality #HotelManagement #AuditManagement`,
  },
];

async function updatePage(id, titulo, copy) {
  await notion.pages.update({
    page_id: id,
    properties: {
      Nombre: { title: [{ text: { content: titulo } }] },
      COPY: { rich_text: [{ text: { content: copy } }] },
    },
  });
}

async function main() {
  console.log(`Updating ${POSTS.length} posts to English...\n`);

  for (const post of POSTS) {
    try {
      await updatePage(post.id, post.titulo, post.copy);
      console.log(`✅ "${post.titulo}"`);
    } catch (err) {
      console.error(`❌ ${post.id}: ${err.message}`);
    }
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});