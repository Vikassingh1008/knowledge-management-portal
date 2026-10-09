# Technical Working Document

## Attendance and Leave Request

**Source:** `Complete_Power_Automate_Flows_Excel_Documentation.pdf`  
**Platform:** Microsoft Power Automate, SharePoint, Microsoft Teams  
**Audience:** Developers, support, and operations who need to understand how these flows run  
**Date:** 7 October 2026

This document explains how the attendance and leave-request flows work. It follows the flow names, triggers, data sources, processing steps, and outputs recorded in the source documentation. It does not add columns, filters, or approval rules that the source does not describe.

---

## 1. What these flows do

Attendance and leave are handled by a set of Power Automate flows. They read employee, contact, attendance, and leave-request data from SharePoint, calculate who is present, late, short on login hours, or on leave, and post the result to a Microsoft Teams group chat.

Leave is not a separate approval product in this documentation. Leave requests live in the SharePoint **Leave Request** list. Attendance and daily leave reports read that list, match it to employees, and publish leave status. One related timesheet flow also checks user leave and approval before it rearranges time buckets.

| Area | What the flows produce |
| --- | --- |
| Team attendance | HHHH attendance table with leave and availability |
| Late login | Count and table of employees who logged in late |
| Short login hours | Table of employees whose login hours are short, plus a late-login table |
| Today’s leave | Table of employees on leave today, or a “No leaves today” message |
| Client leave | HTML leave report, including leave details and leave status, posted to Teams |
| Meeting attendance | Attendance duration written back to SharePoint tasks and time entries |

---

## 2. Systems involved

| System | Role |
| --- | --- |
| Power Automate | Runs the scheduled and automated flows |
| SharePoint | Stores Leave Request, Contacts, Employees, attendance items, tasks, and time entries |
| Microsoft Teams | Receives HTML reports and group-chat messages |
| India Standard Time (IST) | Schedule timezone for the daily reports |

SharePoint lists named in the attendance and leave flows:

- **Leave Request** — leave records used by the HHHH attendance report and the daily leave report
- **Contacts** — used by the HHHH attendance report
- **Employees** — employee master data used when matching leave and attendance

The source does not list the column names inside these lists.

---

## 3. Flow catalog

| Flow name | Type | When it runs | Result |
| --- | --- | --- | --- |
| Attendance Report HHHH | Scheduled | Every day at 12:00 PM IST | HHHH attendance HTML report in a Teams group chat |
| LoginHoursShorts | Scheduled | Every day at 12:00 PM IST | Short-hours table and late-login table in Teams, on weekdays |
| LateloginCountReport | Scheduled | Every day at 12:01 PM IST | Late-login count table in Teams, except weekends |
| Today's Leave Report Daily | Scheduled | Every day at 1:00 PM IST | Today’s leave table in Teams on weekdays when someone is on leave |
| Clients Leave Report | Automated | When its trigger payload arrives | Client leave HTML posted to a Teams group chat |
| Metting Attendance Time | Automated | When a SharePoint item is created or modified, if attendance and JSON conditions are met | Attendance time written to tasks and time entries |

Spelling in this document matches the flow names in the source (`LateloginCountReport`, `Metting Attendance Time`, `LoginHoursShorts`).

---

## 4. Daily run order

On a normal weekday the scheduled reports run in this order:

```text
12:00 PM IST   Attendance Report HHHH
               LoginHoursShorts

12:01 PM IST   LateloginCountReport

 1:00 PM IST   Today's Leave Report Daily
```

Weekend behavior is not the same for every flow:

- **LateloginCountReport** does not post on weekends.
- **LoginHoursShorts** posts only on weekdays.
- **Today's Leave Report Daily** posts only when it is a weekday and there is at least one leave.
- **Attendance Report HHHH** is documented as a daily 12:00 PM run. The source does not say it skips weekends.

`Clients Leave Report` and `Metting Attendance Time` are not on this clock. They run when their trigger fires.

---

## 5. Attendance Report HHHH

**Type:** Scheduled  
**Purpose:** Build the HHHH team attendance report, including who is on leave and who is available, and post it as a table in Teams.

### How it works

1. **Trigger.** A recurrence starts the flow every day at 12:00 PM India Standard Time.
2. **Read SharePoint.** The flow loads data from three lists:
   - Leave Request
   - Contacts
   - Employees
3. **Process.** It filters the records, matches employees across those lists, counts employees, and calculates leave statistics.
4. **Build the report.** It turns the matched data into an HTML report. The report covers leave and availability for the HHHH teams and employees.
5. **Output.** It posts that report in a Microsoft Teams group chat.

### What this flow is responsible for

This is the main daily attendance picture for HHHH. Leave Request is an input here, so an employee on leave is identified inside the attendance report, not only in the later leave-only report.

### What the source does not specify

- The exact filter expressions
- Which employee field is used to match a leave request
- The Teams chat or channel id
- Whether the post is skipped on weekends or holidays

---

## 6. Login hours and late login

Two scheduled flows report attendance quality: short login hours and late logins. They both read SharePoint attendance data and post tables to a Teams group chat.

### 6.1 LoginHoursShorts

**Type:** Scheduled  
**Trigger:** Every day at 12:00 PM IST.

**Working steps**

1. Get items from a SharePoint list, filtered by date.
2. Transform the items.
3. Split them into two groups:
   - employees with short login hours
   - employees with late logins
4. Build two HTML tables, one for each group.
5. If a table has no rows, add a row that says **No data available for today**.
6. On weekdays, post both tables to a Microsoft Teams group chat.

### 6.2 LateloginCountReport

**Type:** Scheduled  
**Trigger:** Every day at 12:01 PM IST.

**Working steps**

1. Read employee attendance data from SharePoint.
2. Filter two sets of employees:
   - employees who spent more time
   - employees with late logins
3. Store the day, the date, and the late-login counts in variables.
4. Build a late-login report table.
5. Post the report in a Teams group chat.
6. Do not post on weekends.

### How the two late-login reports differ

| Point | LoginHoursShorts | LateloginCountReport |
| --- | --- | --- |
| Clock time | 12:00 PM IST | 12:01 PM IST |
| Main output | Short login hours, plus late logins | Late-login counts and a late-login table |
| Extra filter | Date filter on the SharePoint get | Employees who spent more time, and late logins |
| Empty data | Inserts “No data available for today” | Not described |
| Weekend | Posts on weekdays | Does not post on weekends |

The source does not define the minute threshold that counts as a late login or a short day.

---

## 7. Leave request — how it is used

Leave requests are stored in SharePoint and consumed by the reports below. The source describes reporting and status publishing. It does not describe a flow that grants, approves, or rejects a leave permission by itself.

### 7.1 Today's Leave Report Daily

**Type:** Scheduled  
**Purpose:** Tell the team who is on leave today.

**Working steps**

1. **Trigger.** Recurrence every day at 1:00 PM IST.
2. **Prepare data.** Initialize variables, then fetch employee data and leave data from SharePoint.
3. **Match.** Match each leave request to the employee record.
4. **Filter.** Keep only leaves that apply to today.
5. **Format.** Build a formatted HTML table.
6. **Decide whether to post.**
   - If it is a weekday **and** there is at least one leave, post the table to a Teams group chat.
   - If nobody is on leave, the message is **No leaves today**.

This flow runs one hour after the HHHH attendance report, so the 12:00 PM attendance post can already include leave statistics, and the 1:00 PM post is the leave-only list for the same day.

### 7.2 Clients Leave Report

**Type:** Automated  
**Purpose:** Publish a client leave report that includes employee leave details and leave status.

This flow does not build the report from SharePoint lists inside the documented steps. It receives a payload that already contains the HTML.

**Working steps**

1. **Compose.** Take the trigger body and prepare it for the next actions.
2. **Parse JSON.** Read three fields from that body:
   - `html` — the report markup to post
   - `reportPreset` — which report preset was used
   - `generatedAt` — when the report was generated
3. **Initialize variable.** Create a string variable named `leaveRows`.
4. **Post to Teams.** Post a message to a Microsoft Teams group chat using the parsed HTML.

The documented action order is Compose, then Parse JSON, then Initialize variable, then Post message in a chat or channel.

The source does not say which trigger starts this flow (for example HTTP, another flow, or a SharePoint item). It also does not show `leaveRows` being filled before the post. The message that is posted is the parsed `html`.

### 7.3 Where leave status and approval appear

| Place | What the source says |
| --- | --- |
| Leave Request list | Input to Attendance Report HHHH, together with Contacts and Employees |
| Attendance Report HHHH | Calculates leave statistics and shows leave and availability |
| Today's Leave Report Daily | Matches leave requests to employees and lists today’s leaves |
| Clients Leave Report | Publishes employee leave details and leave status |
| HHHHQA ReArrange time bucket | Automates timesheet and task management, including user leave and approval checks |

**Leave Request Permission**, as a named approval flow, is not in the source catalog. The closest documented behavior is:

- leave **status** is carried in the client leave report
- user **leave and approval checks** run inside **HHHHQA ReArrange time bucket** before time-bucket changes are applied

That QA flow starts when an item or file is modified in SharePoint. It retrieves changes, initializes variables, processes tasks, manages time entries, and uses conditions and loops for task assignment, time tracking, and SharePoint updates. The source states that this includes user leave and approval checks. It does not list the approver, the permission field, or the approve/reject branches.

---

## 8. Meeting attendance time

**Flow name:** Metting Attendance Time  
**Type:** Automated  
**Purpose:** When meeting attendance is saved, capture how long each person attended and write that time onto the related SharePoint task and time entry.

### How it works

1. **Trigger.** An item is created or modified in SharePoint. The flow continues only when its attendance and JSON conditions are met.
2. **Parse attendance.** A Compose action reads the attendance JSON.
3. **Set variables.** Initialize attendance variables and set their values.
4. **Load the task.** Get the task id and send an HTTP request to SharePoint for the task details.
5. **Load people.** Get all users and initialize an array variable named `ArrayTime`.
6. **Apply to each attendance row.** For every entry in the attendance array:
   - check the conditions for that row
   - update an existing SharePoint item or create a new one
   - apply the extra time-entry logic

The result is attendance duration stored with the task, not a Teams report. The daily attendance reports in sections 5 and 6 are separate flows.

---

## 9. End-to-end picture

```text
SharePoint
  Employees + Contacts + Leave Request
  Attendance items
  Meeting item (attendance JSON)
        |
        v
Power Automate
  12:00  Attendance Report HHHH  -> HTML attendance + leave stats
  12:00  LoginHoursShorts        -> short hours + late login tables
  12:01  LateloginCountReport    -> late login counts
  13:00  Today's Leave Report    -> who is on leave today
  event  Clients Leave Report    -> client HTML (html, reportPreset, generatedAt)
  event  Metting Attendance Time -> task + time entry updates
        |
        v
Microsoft Teams group chat
  (reports only; meeting attendance time stays in SharePoint)
```

A leave request affects the reports only after it exists in SharePoint:

1. Someone creates or updates a row in **Leave Request**.
2. At 12:00 PM, **Attendance Report HHHH** matches that row with Employees and Contacts and includes it in leave statistics and availability.
3. At 1:00 PM, **Today's Leave Report Daily** matches the same leave data to employees, keeps today’s leaves, and posts the table, or posts **No leaves today**.
4. **Clients Leave Report** publishes a prepared HTML report, including leave status, when its trigger body arrives.
5. **HHHHQA ReArrange time bucket** can take user leave and approval into account when it updates timesheets. That check is part of the time-bucket flow, not part of the 12:00 or 1:00 report flows.

---

## 10. Business rules that are explicit

| Rule | Flow |
| --- | --- |
| Run daily at 12:00 PM IST | Attendance Report HHHH, LoginHoursShorts |
| Run daily at 12:01 PM IST | LateloginCountReport |
| Run daily at 1:00 PM IST | Today's Leave Report Daily |
| Read Leave Request, Contacts, and Employees | Attendance Report HHHH |
| Match leave requests to employee details | Today's Leave Report Daily |
| Keep only today’s leaves | Today's Leave Report Daily |
| Post the leave table on a weekday when leaves exist | Today's Leave Report Daily |
| Show “No leaves today” when there are no leaves | Today's Leave Report Daily |
| Show “No data available for today” when a table is empty | LoginHoursShorts |
| Post short-hours and late-login tables on weekdays | LoginHoursShorts |
| Do not post the late-login report on weekends | LateloginCountReport |
| Post parsed `html` to a Teams group chat | Clients Leave Report |
| Continue only when attendance and JSON conditions match | Metting Attendance Time |
| Update or create SharePoint items from each attendance row | Metting Attendance Time |

---

## 11. Variables and payload fields

| Name | Flow | Use |
| --- | --- | --- |
| Day, date, late login counts | LateloginCountReport | Values used to build the late-login table |
| Variables initialized before the employee and leave fetch | Today's Leave Report Daily | Working storage while the daily leave table is built |
| `leaveRows` (string) | Clients Leave Report | Initialized after JSON is parsed |
| `html` | Clients Leave Report | Report body posted to Teams |
| `reportPreset` | Clients Leave Report | Preset that produced the report |
| `generatedAt` | Clients Leave Report | Generation timestamp |
| Attendance variables | Metting Attendance Time | Hold parsed attendance values |
| `ArrayTime` | Metting Attendance Time | Array filled while users and attendance rows are processed |

---

## 12. Outputs

| Flow | Output | Destination |
| --- | --- | --- |
| Attendance Report HHHH | HTML attendance report with leave and availability | Teams group chat |
| LoginHoursShorts | Two HTML tables (short hours, late login) | Teams group chat, weekdays |
| LateloginCountReport | Late-login report table | Teams group chat, except weekends |
| Today's Leave Report Daily | HTML leave table, or “No leaves today” | Teams group chat |
| Clients Leave Report | Message built from parsed HTML | Teams group chat |
| Metting Attendance Time | Created or updated items and time entries | SharePoint |

---

## 13. Support notes

Use this order when a report is missing or wrong.

1. Confirm the flow ran at its scheduled time in IST. Attendance and short hours are 12:00 PM, late-login count is 12:01 PM, and today’s leave is 1:00 PM.
2. If the issue is weekend silence, check the rule first. Late-login count is skipped on weekends. Short hours post on weekdays. Today’s leave posts on a weekday only when leaves exist.
3. If HHHH attendance is missing people or leave totals, check **Leave Request**, **Contacts**, and **Employees**. The flow matches and counts across those three lists.
4. If today’s leave list is wrong, check that the leave request matches an employee and that the leave date is today. Unmatched or non-today rows are filtered out before the HTML table is built.
5. If the client leave message is empty or old, inspect the trigger body fields `html`, `reportPreset`, and `generatedAt`. The flow posts `html`; it does not rebuild the report from the Leave Request list in the documented steps.
6. If meeting attendance duration is missing on a task, confirm the SharePoint item change satisfied the attendance and JSON conditions, that the attendance JSON parsed, and that the task id HTTP request returned the task. Each attendance row then updates or creates the SharePoint item and time entry.

---

## 14. Related flow (leave check only)

**HHHHQA ReArrange time bucket** is a timesheet flow, not an attendance report. It is listed here because the source says it includes **user leave and approval checks**.

- **Trigger:** an item or file is modified in the SharePoint site.
- **Actions:** retrieve changes, initialize variables, process tasks, manage time entries.
- **Logic:** conditions and loops handle task assignment, time tracking, and SharePoint list updates.
- **Leave:** user leave and approval are checked as part of that timesheet update.

No separate flow in the source is named Leave Request Permission, and no approve or reject steps are documented for the Leave Request list.
