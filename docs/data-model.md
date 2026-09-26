# SSC Registration System — Data Model

## Table: registrations

All fields from the Google Form mapped to database columns.

### Core Identity

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | uuid | auto | Primary key |
| created_at | timestamptz | auto | Submission timestamp |
| email | text | yes | Google account email (auto-recorded) |

### Personal Info (Page 2)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| full_name | text | yes | |
| contact_number | text | yes | WhatsApp preferred |
| faculty_institute | text | yes | PIET / PIT / Other |
| programme_course | text | yes | e.g. B.tech CSE-AIML |
| current_semester_year | text | yes | |
| division_batch | text | no | |
| developer_profile | text | no | Link |
| github_profile | text | no | |
| linkedin_profile | text | no | |
| portfolio_website | text | no | |

### Verification (Pages 3–4)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| has_uni_email | boolean | yes | Yes/No toggle |
| uni_email | text | conditional | Shown if has_uni_email = true |
| uni_enrollment_id | text | conditional | Shown if has_uni_email = true |
| personal_email | text | conditional | Shown if has_uni_email = false |
| student_status | text | yes | Fresher / D2D / Other |
| enrollment_number | text | yes | e.g. 25UG0XXX |

### Device & Access (Page 5)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| mac_access | text | yes | MacBook / iPad / Both / Neither |
| device_frequency | text | no | Daily / Several times a week / etc. |
| needs_mac_lab | text | yes | Yes / No / Not sure / Other |
| hours_per_week_prep | text | yes | <2h / 2-5h / 5-10h / >10h |

### Experience (Page 6)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| app_experience | text | yes | Never built → Published app |
| apple_experience | text | yes | Exploring → Previously submitted |
| independence_confidence | text | yes | Significant guidance → Comfortable |
| interests_improving | text[] | no | Array of checkboxes |
| previous_competitions | boolean | yes | Yes/No |
| competition_details | text | conditional | Shown if previous_competitions = true |

### Commitment (Page 7)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| commitment_level | text | yes | Consistently / Most weeks / etc. |
| hours_per_week_program | text | yes | <2h / 2-5h / 5-10h / >10h |
| work_schedule | text[] | yes | Array: Morning / Evening / Saturday / etc. |
| willing_to_attend | text | yes | Yes / Mostly / No |

### Idea & Motivation (Page 8)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| why_interested | text | yes | Long answer |
| has_idea | text | yes | Yes / Rough idea / Exploring / No |
| idea_description | text | no | Long answer — optional, "N/A" accepted |
| excitement_level | text[] | yes | Array of checkboxes |
| build_interest | text[] | yes | Array: iOS app / Game / AI-ML / etc. |

### Consent (Page 9)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| confirm_accurate | boolean | yes | |
| understand_no_guarantee | boolean | yes | |
| agree_contact | boolean | yes | |
| anything_else | text | no | Long answer |

## Indexes

- `created_at` — sort submissions by date
- `faculty_institute` — filter by faculty
- `student_status` — filter by student type

## Row Level Security

| Policy | Operation | Who |
|--------|-----------|-----|
| Public insert | INSERT | Anyone (anonymous) |
| Admin read | SELECT | Authenticated admins only |
| No update | UPDATE | Blocked |
| No delete | DELETE | Blocked |

The anonymous key used by the form site can only INSERT. It cannot read or modify existing rows. The dashboard will use an authenticated session with admin privileges to read submissions.
