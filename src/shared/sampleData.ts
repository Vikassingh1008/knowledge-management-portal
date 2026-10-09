import { IArticle } from './models';

function article(
  id: number,
  articleName: string,
  category: string,
  authorName: string,
  startDate: string,
  endDate: string,
  section: string,
  lastUpdated: string,
  description: string
): IArticle {
  return {
    id: id,
    title: articleName,
    articleName: articleName,
    description: description,
    category: category,
    authorName: authorName,
    startDate: startDate,
    endDate: endDate,
    status: 'Published',
    published: true,
    articleUrl: '',
    viewCount: 0,
    section: section,
    lastUpdated: lastUpdated,
    modified: lastUpdated
  };
}

export const SAMPLE_ARTICLES: IArticle[] = [
  article(
    1,
    'Top 10 Skills to Thrive in the Digital Age',
    'Operations',
    'John',
    '2023-08-01',
    '2026-12-31',
    '2.1',
    '25 Aug 2023',
    'Section: 2.1\nLast updated: 25 Aug 2023\n\nThis article lists ten skills employees should build: digital collaboration, data literacy, secure remote work, customer communication, automation awareness, inclusive teamwork, problem framing, stakeholder updates, continuous learning, and knowledge sharing. Use the knowledge portal to find a course for each skill and agree a development goal with your manager.'
  ),
  article(
    2,
    'Navigating the Future of Remote Learning',
    'Finance',
    'Natasha',
    '2023-06-01',
    '2026-12-31',
    '1.4',
    '12 Jun 2023',
    'Section: 1.4\nLast updated: 12 Jun 2023\n\nRemote learning is funded from the team learning budget. Complete the course in the approved catalog, record the cost centre, and submit the completion date to Finance. Manager approval is required before paid external courses are booked.'
  ),
  article(
    3,
    'What Leonardo Teaches Us About Web Design',
    'IT',
    'William',
    '2023-07-01',
    '2026-12-31',
    '3.2',
    '29 Jul 2023',
    'Section: 3.2\nLast updated: 29 Jul 2023\n\nDesign internal pages with a clear hierarchy, generous contrast, and keyboard access. Prefer structured headings, visible focus, and text that still makes sense without colour alone. Review new portal pages against WCAG 2.1 AA before they are published.'
  ),
  article(
    4,
    'IT Asset Management Policy',
    'IT',
    'IT Service Desk',
    '2025-01-01',
    '2026-12-31',
    '4.2',
    '12 Jan 2025',
    'Section: 4.2\nLast updated: 12 Jan 2025\n\nIT Asset Policy v2.3 covers laptop replacement. Employees must raise a ServiceNow request under "Hardware Replacement" when a laptop is lost, damaged, or due for refresh. Approval from the reporting manager is required before a replacement device is issued. Do not purchase hardware outside the standard catalog.'
  ),
  article(
    5,
    'Employee Leave and Absence Policy',
    'HR',
    'HR Operations',
    '2024-04-01',
    '2026-12-31',
    '5.1',
    '02 Apr 2024',
    'Section: 5.1\nLast updated: 02 Apr 2024\n\nRequest annual leave in the HR system at least five working days in advance. Sick absence must be recorded on the first day. Leave longer than ten working days needs manager approval. Public holidays follow the employee work location.'
  ),
  article(
    6,
    'Information Security Awareness Standard',
    'Security',
    'Security Office',
    '2024-09-15',
    '2026-12-31',
    '6.3',
    '15 Sep 2024',
    'Section: 6.3\nLast updated: 15 Sep 2024\n\nLock your screen when you step away. Report phishing with the Report Phish button and do not forward the message. Store client data only in approved SharePoint sites. Multi-factor authentication is mandatory for email, VPN, and admin tools.'
  ),
  article(
    7,
    'Expense Reimbursement Guide',
    'Finance',
    'Finance Shared Services',
    '2024-11-01',
    '2026-12-31',
    '7.2',
    '01 Nov 2024',
    'Section: 7.2\nLast updated: 01 Nov 2024\n\nSubmit expense claims within 30 days, with a receipt for any item over the local threshold. Travel must be booked through the approved agency. Manager approval is required before Finance pays the claim. Personal expenses are not reimbursed.'
  ),
  article(
    8,
    'Operations Incident Response Playbook',
    'Operations',
    'Operations Control',
    '2025-02-10',
    '2026-12-31',
    '8.1',
    '10 Feb 2025',
    'Section: 8.1\nLast updated: 10 Feb 2025\n\nRaise a Severity 1 incident by phone and in the operations channel within 15 minutes. Name an incident lead, post updates every 30 minutes, and record the customer impact. Close the incident only after the service owner accepts the recovery notes.'
  ),
  article(
    9,
    'New Joiner Onboarding Guide',
    'HR',
    'People Team',
    '2025-03-01',
    '2026-12-31',
    '9.4',
    '01 Mar 2025',
    'Section: 9.4\nLast updated: 01 Mar 2025\n\nNew joiners complete identity checks, security training, and equipment setup in the first week. The manager assigns a buddy and confirms system access. Laptop requests follow the IT Asset Management Policy. Mandatory courses must be finished within 30 days.'
  ),
  article(
    10,
    'Data Privacy and GDPR Basics',
    'Security',
    'Privacy Office',
    '2024-05-20',
    '2026-12-31',
    '10.2',
    '20 May 2024',
    'Section: 10.2\nLast updated: 20 May 2024\n\nCollect only the personal data required for the stated purpose. Do not export client personal data to personal email or unmanaged devices. Privacy questions and suspected breaches go to the Privacy Office the same day. Retention follows the schedule for that process.'
  )
];
