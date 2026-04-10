# ZOHO PROJECTS - COMPLETE SYSTEM DOCUMENTATION
## Comprehensive Nested Phases Reference Guide for TaskFlow Development

> **Purpose:** This document provides an exhaustive, phase-by-phase documentation of every feature, button, field, dialog, dropdown, and workflow in Zoho Projects. Use this as the blueprint for building TaskFlow.
>
> **Generated:** April 10, 2026
> **Total Coverage:** 15+ modules, 200+ UI elements, 50+ forms and dialogs

---

## TABLE OF CONTENTS

1. [System Overview & Navigation](#system-overview)
2. [New Project Creation Workflow](#new-project-creation)
3. [Tasks Module](#tasks-module)
4. [Issues Module](#issues-module)
5. [Phases & Time Logs Module](#phases-time-logs)
6. [Dashboard, Reports & Collaboration](#dashboard-reports-collab)
7. [Timesheets, Users, Documents & Automation](#timesheets-users-docs)
8. [Implementation Guide for TaskFlow](#implementation-guide)

---

# PART 1: SYSTEM OVERVIEW & NAVIGATION

## Global Navigation Structure

### Left Sidebar Menu
| Menu Item | Purpose | Keyboard Shortcut |
|-----------|---------|-------------------|
| Home | Dashboard with summary cards (Open/Closed Tasks, Issues, Phases) | Z + H |
| Reports | Workload reports, analytics, resource allocation heatmaps | Z + R |
| Projects | Project listing with Active/Templates/Groups/Public/Archived tabs | Z + P |
| Collaboration | Feed, Calendar, and Chat for team communication | - |
| My Approvals | Timesheet approval workflows and pending items | - |
| Tasks | Cross-project task list with grouping and filtering | - |
| Issues | Cross-project issue tracker with severity levels | - |
| Phases | Milestone/phase management with progress tracking | - |
| Time Logs | Time entry management with billing types | - |
| Timesheets | Timesheet aggregation with approval workflows | - |

### Top Header Icons (Left to Right)
| Icon | Purpose | What Opens When Clicked |
|------|---------|------------------------|
| + (Add) | Quick-add menu | Dropdown with: New Project, New Task, New Issue, New Phase, etc. |
| Search (magnifying glass) | Global search | Search bar with type-ahead suggestions across all entities |
| Bell (Notifications) | Notification center | Panel showing recent activity, mentions, assignments |
| Timer | Time tracker | Running timer for active time logging |
| Gear (Settings) | Portal settings | Settings page with portal configuration |
| User Avatar (circle) | User profile menu | Dropdown: Theme, Settings, Profile, Help, Sign Out |
| Grid (9 dots) | App switcher | Zoho app grid showing all Zoho products |

### New Project Creation Form Fields
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| Project Title | Text input | YES (*) | Empty | Has info icon (i) with tooltip |
| Owner | Dropdown | No | Current user | Shows all portal users |
| Template | Dropdown | No | "Select" | Available templates from gallery |
| Start Date | Date picker | No | Empty | MM-DD-YYYY format, calendar popup |
| End Date | Date picker | No | Empty | MM-DD-YYYY format, must be >= Start Date |
| Make this a strict project | Checkbox | No | Unchecked | Info icon explains strict scheduling |
| Project Group | Dropdown | No | "Select" | Has "Add new group" link |
| Description | Rich text editor | No | Empty | Full WYSIWYG toolbar |
| Business Hours | Dropdown | YES (*) | "Standard Business Hours" | Affects scheduling calculations |
| Task Layout | Display only | No | "Standard Layout" | Shows current task layout |
| Tags | Tag input | No | Empty | "Enter a tag name" placeholder |
| Roll-up | Checkbox | No | Unchecked | Roll-up dates from Tasks/subtasks to phases |
| Customize tabs | Checkboxes | No | All checked | Dashboard, Tasks, Users enabled by default |

### Template Gallery Categories
- All, Project Templates, Software/IT, Construction, Pharma, Manufacturing, Marketing/Sales

---


# PART 2: TASKS MODULE

# Zoho Projects - TASKS Section Documentation

Complete reference guide for the Zoho Projects Tasks module, documenting all buttons, fields, dropdowns, and controls across all task management interfaces.

---

## Section 1: Tasks List Page

### Overview
The Tasks list view displays all project tasks in a tabular format with grouping by Task List, filtering options, and multiple view modes.

### Page Header Elements

#### View Mode Buttons (Top Left)
- **List** (default view) - Table view of all tasks
- **Gantt** - Gantt chart view for timeline visualization
- **Kanban** - Kanban board view for task workflows

### Toolbar Controls (Top Right)

#### Primary Action Button
- **Add Task** (Blue button with "+" icon)
  - Shortcut: Ctrl+T
  - Opens New Task creation form
  - Also includes dropdown arrow showing "Add More" option

#### View Controls
- **List** - View type selector dropdown
- **Filters** - Opens filter panel for custom filtering
- **Other Actions** (three dots menu) - Additional options
- **Group By** - Currently set to "Task List" with dropdown to change grouping
- **Automation** - Automation rules manager

#### Additional Buttons
- **Add Task List** (C+A) - Create a new task list/category
- **Suggestions** - AI-powered task suggestions feature

### Table Column Headers (Displayed in List View)

| Column | Description | Sortable | Editable |
|--------|-------------|----------|----------|
| ID | Task identifier (e.g., T-1-11) | Yes | No |
| Task Name | Name of the task | Yes | Yes (inline) |
| Owner | Assigned user/resource | Yes | Yes (inline) |
| Status | Current task status | Yes | Yes (inline) |
| Tags | Task tags/labels | Yes | Yes (inline) |
| Start Date | Task start date | Yes | Yes (inline) |
| Due Date | Task due date | Yes | Yes (inline) |
| Duration | Task duration (days/hours) | Yes | Yes (inline) |
| Priority | Task priority level | Yes | Yes (inline) |
| Completion Percentage | Progress indicator | Yes | Yes (inline) |
| Timelog Total (T) | Total logged hours | Yes | No |
| Add Column | Add custom columns | N/A | N/A |

### Left Side Panel

#### Filter/View Options
- **All Open** (dropdown) - Filter by task status
- **Data last fetched on** [timestamp] - Shows last refresh time
- **Add to Favorite** (star icon) - Mark view as favorite
- **More Actions** (three dots)
  - Edit Custom View
  - Copy Link
  - Set as default view
  - Remove default view for all users
  - Set as default view for all users

### Task Row Context Menu (Right-click on task)

- **View Details** (Ctrl+Enter) - Open task detail panel
- **View Details in New Tab** - Open task in new browser tab
- **Copy Link** - Copy task URL to clipboard
- **Color** - Change task row color
- **Move** - Move task to different task list
- **Create Task Above** (Ctrl+Shift+↑) - Create task above current
- **Create Task Below** (Ctrl+Shift+↓) - Create task below current
- **Add Subtask** - Create a subtask of this task
- **Clone** - Duplicate the task
- **Trash** - Delete task (red text)

### Expanded Task Row Quick Actions (Click checkbox)

When a task row is expanded, the following quick action buttons appear:
- **Move** - Relocate task to different list
- **Trash** - Delete task
- **Associate Issues** - Link issues to task
- **Owner** - Change task owner
- **Status** - Change task status
- **Tags** - Add/edit task tags
- **Start Date** - Set task start date
- **Due Date** - Set task due date
- **Priority** - Set task priority level
- **Associated Team** - Assign team to task
- **Billing Type** - Set billing classification

### Grouping Options

Currently grouped by "Task List" which shows:
- Task List name as section header (e.g., "General (1)")
- Count of tasks in parentheses
- Collapsible/expandable sections
- Sort options for each task list

---

## Section 2: Add Task Form (Task Creation Dialog)

### Form Header
- **Title**: "New Task"
- **Project Reference**: "TaskFlow - Website Redesign" (shows current project)
- **Layout**: Private Layout (with edit option)
- **Close Button**: X icon to cancel
- **Help Icon**: Access to form help resources

### Core Task Fields

#### Task Name (Required field)
- **Type**: Text input
- **Placeholder**: Empty
- **Max Length**: Not specified
- **Required**: Yes (marked with red asterisk)
- **Validation**: Must be provided to submit form

#### Add Description (Collapsible/Expandable)
- **Type**: Rich text editor
- **Default**: Collapsed with "Add Description" label
- **Features**:
  - Bold (Ctrl+B), Italic (Ctrl+I), Underline (Ctrl+U), Strikethrough (Ctrl+Shift+X)
  - Font selection (Puvi default)
  - Font size (13 default)
  - Font color
  - Background color
  - Text alignment (left, right, center, justify)
  - Bullet lists and numbered lists
  - Indent controls
  - Text direction (LTR/RTL)
  - Line spacing options
  - Superscript/Subscript
  - Insert image
  - More formatting options
  - Generate content with AI
  - Expand editor button

### Task Organization Fields

#### Task List (Dropdown)
- **Type**: Dropdown select
- **Default Value**: "General"
- **Options**: List of all available task lists in project
- **Required**: Yes

#### Attachments Section
- **Type**: File upload area (drag and drop)
- **Placeholder**: "Drop files or add attachments here..."
- **Max Files**: 10 files
- **Allowed Types**: Not specified in form

### Task Information Section (Collapsible)

#### Associated Team (Dropdown)
- **Type**: Dropdown/Combobox
- **Placeholder**: "Select"
- **Default**: Empty
- **Required**: No
- **Searchable**: Yes
- **Multi-select**: Unknown

#### Owner (Dropdown)
- **Type**: Dropdown/Combobox
- **Placeholder**: "Select User/Resource"
- **Default**: Empty
- **Required**: No
- **Searchable**: Yes
- **Options**: List of project users/resources

#### Work Hours (Time input)
- **Type**: Dropdown spinner
- **Default**: "0:00"
- **Format**: HH:MM
- **Required**: No

#### Start Date (Date picker)
- **Type**: Text input with calendar picker
- **Placeholder**: "mm-dd-yyyy"
- **Format**: mm-dd-yyyy
- **Default**: Empty
- **Required**: No
- **Features**: Clear Dates button

#### Due Date (Date picker)
- **Type**: Text input with calendar picker
- **Placeholder**: "mm-dd-yyyy"
- **Format**: mm-dd-yyyy
- **Default**: Empty
- **Required**: No
- **Features**:
  - Clear Dates button
  - "Enter Duration" link
  - Supported Hour Formats info (e.g., "2:50 - Two hours and fifty mins")

#### Duration (Multiple inputs)
- **Type**: Composite field (number + dropdown)
- **Components**:
  - Duration value input (text)
  - Unit selector dropdown (days/hrs)
  - Label: "days" or "hrs"
- **Default**: Empty
- **Required**: No
- **Note**: Duration can be entered in days or hours

#### Priority (Dropdown)
- **Type**: Dropdown select
- **Default**: "None"
- **Options**:
  - None
  - Low
  - Medium
  - High
- **Required**: No

### Tags Section

#### Tags (Text input with autocomplete)
- **Type**: Tag input with autocomplete
- **Placeholder**: "Enter a tag name"
- **Features**:
  - Add new tags
  - Select existing tags
  - Color coding option ("Select Color" button)
  - "Create" button to add new tag
- **Multi-select**: Yes

### Reminder Section (Collapsible)

#### Reminder Type (Dropdown)
- **Options**:
  - Daily
  - On (specific date)
  - Before (specific time before due date)
  - After (specific time after start date)
- **Default**: "Daily"

#### Time Settings
- **Time field**: Shows "09:00 AM" default
- **Increment/Decrement buttons**: Adjust time
- **Date field**: Calendar picker for reminder date

#### Notification Settings (Dropdown)
- **Type**: Dropdown
- **Default**: "NA"
- **Options**: List of selectable notification recipients

#### Email Template (Dropdown)
- **Options**: Available email templates
- **Default**: "None"
- **Link**: "Create mail template" for custom templates

#### Reminder Actions
- **Set Reminder** button
- **Remove Reminder** link

### Recurrence Section (Collapsible)

#### Schedule Name (Dropdown)
- **Type**: Dropdown select
- **Default**: Empty
- **Options**: Predefined schedules

#### Based On (Dropdown)
- **Options**:
  - Start Date (selected by default)
  - Due Date
  - Schedule
- **Note**: Selected date range is static for recursive recurrence

#### Repeat Every (Composite)
- **Components**:
  - Number input (default: 1)
  - Unit dropdown (day(s), week(s), month(s), year(s))
- **Label**: "day(s)"

#### Time Settings
- **Time spinners**: Hour (09) and Minutes (00)
- **AM/PM radio buttons**: Two options
- **Display**: "At the time [HH:MM AM/PM]"

#### Ends (Dropdown + Inputs)
- **Options**:
  - Never (default)
  - After [X] occurrences
  - On [specific date]
- **Inputs**: Number of occurrences or end date

#### On Holidays (Dropdown)
- **Options**:
  - Skip Schedule
  - Reschedule
  - Execute
- **Default**: "Skip Schedule"

#### Trigger (Dropdown)
- **Options**:
  - On Completion (selected by default)
  - On Schedule
- **Description**: "Carry over selected details to each recurring task"

#### Include in Recurring Task (Checkboxes)
- **Options**:
  - Select All (checkbox)
  - Comments
  - Subtasks
  - Billing Type
  - Followers
  - Description
  - Tags
  - Attachments
  - Associated Teams

#### Recurrence Actions
- **Set Recurrence** button
- **Delete** link to remove recurrence
- **Save** button to confirm recurrence settings
- **Cancel** button to discard changes

### Billing Section

#### Billing Type (Dropdown)
- **Type**: Dropdown select
- **Default**: "None"
- **Options**:
  - None
  - Billable
  - Non Billable
- **Required**: No

#### Budget/Financial Fields (Text inputs, read-only in creation)
- Rate Per Hour: "0.00"
- Budgeted Hours: "0.000"
- Budgeted Hours Threshold: "0.000"
- Cost Budget: "0.000"
- Cost Budget Threshold: "0.000"
- Cost Per Hour: "0.00"
- Revenue Budget: "0.000"

### Calendar Integration (Optional Features)

#### Google Calendar/Tasks
- **Checkbox**: "Add to Google Calendar/Task"
- **Status**: Requires setup/activation

#### Office 365 Integration
- **Checkbox**: "Add to Office365 Task/Calendar"
- **Status**: Requires setup/activation

#### Microsoft Outlook Integration
- **Checkbox**: "Add to Microsoft Outlook Calendar"
- **Checkbox**: "Add Task to Microsoft Outlook Tasks"
- **Banner**: Integration activation available

### Form Action Buttons

#### Primary Actions (Bottom of form)
- **Add** (Blue button) - Submit and create task
  - Keyboard shortcut: Ctrl+Enter
- **Add More** (Secondary button) - Submit and open new task form
- **Cancel** (Secondary button) - Discard form and close

---

## Section 3: Task Detail View (Right Panel)

### Task Header Section

#### Task Title Bar
- **Task Icon**: Blue "Task" label
- **Task ID**: Displays task number (e.g., "T-1-11") with copy-to-clipboard icon
- **Task Name**: "Design Homepage Mockup" (editable inline textbox)
- **Translate Option**: Translate button (globe icon)
- **More Actions** (three dots menu):
  - Other task actions
  - Edit options

#### Creator Information
- **By [User Name]** (e.g., "By Ankur Jain")
- **Icons for**:
  - Comments indicator
  - Attachments indicator
  - More information
  - Navigation arrows (Previous/Next task)

#### Status Indicator
- **Status Label**: "Open" with green indicator dot
- **Status Dropdown**: Click to change status
- **Label**: "CURRENT STATUS"

### Description Section (Collapsible)

- **Checkbox**: Enable/disable description editing
- **Label**: "Description"
- **Edit icon**: Pencil button to edit
- **Copy icon**: Copy description to clipboard
- **Translate button**: Translate description
- **Show Summary link**: Toggle description summary view
- **Display**: "No Description Available" (if empty)
- **Rich Text Editor** (when editing):
  - All formatting options available
  - User avatar display
  - Save button (Ctrl+Enter)
  - Cancel button

### Task Information Section (Collapsible)

#### Associated Team (Dropdown)
- **Display**: Empty by default
- **Type**: Searchable dropdown
- **Editable**: Yes

#### Owner (Dropdown)
- **Display**: Empty by default
- **Type**: Searchable dropdown
- **Editable**: Yes

#### Work Hours (Time input)
- **Display**: "00:00"
- **Type**: Text input
- **Editable**: Yes
- **Format**: HH:MM

#### Status (Dropdown)
- **Display**: "Open" with green indicator
- **Type**: Dropdown select
- **Editable**: Yes
- **Indicator**: Colored dot showing status

#### Completion Date (Date picker)
- **Type**: Date input field
- **Placeholder**: Calendar icon
- **Editable**: Yes
- **Format**: Based on user locale

#### Start Date (Date picker)
- **Type**: Date input field
- **Placeholder**: Calendar icon
- **Editable**: Yes
- **Format**: Based on user locale

#### Due Date (Date picker)
- **Type**: Date input field
- **Placeholder**: Calendar icon
- **Editable**: Yes
- **Format**: Based on user locale

#### Duration (Text input)
- **Display**: "2 days/hrs"
- **Type**: Text input
- **Placeholder**: "2 days/hrs"
- **Editable**: Yes
- **Unit**: Indicates days or hours

#### Priority (Dropdown)
- **Display**: "High" (with red indicator)
- **Type**: Dropdown select
- **Options**:
  - None
  - Low
  - Medium
  - High
- **Editable**: Yes
- **Indicator**: Visual color coding

#### Completion Percentage (Number input)
- **Display**: "0"
- **Type**: Numeric input with % symbol
- **Range**: 0-100%
- **Editable**: Yes

#### Rate Per Hour (Currency)
- **Display**: "0.00"
- **Type**: Numeric input
- **Editable**: Yes

#### Tags (Tag display)
- **Display**: Tag labels (if any)
- **Type**: Tag input/display
- **Editable**: Yes
- **Features**: Add, remove, manage tags

#### Reminder (Dropdown)
- **Display**: "None"
- **Type**: Dropdown with info icon
- **Editable**: Yes
- **Tooltip**: Explains reminder types (Daily, On, Before, After)

#### Recurrence (Dropdown)
- **Type**: Dropdown select
- **Display**: Empty if no recurrence
- **Editable**: Yes

#### Billing Type (Dropdown)
- **Display**: "None"
- **Type**: Dropdown select
- **Options**:
  - None
  - Billable
  - Non Billable
- **Editable**: Yes

#### Budgeted Hours (Text input)
- **Display**: "0.000"
- **Type**: Numeric input
- **Editable**: Yes

#### Budgeted Hours Threshold (Text input)
- **Display**: "0.000"
- **Type**: Numeric input
- **Editable**: Yes

#### Cost Budget (Text input)
- **Display**: "0.000"
- **Type**: Numeric input
- **Editable**: Yes

#### Cost Budget Threshold (Text input)
- **Display**: "0.000"
- **Type**: Numeric input
- **Editable**: Yes

#### Cost Per Hour (Currency)
- **Display**: "0.00"
- **Type**: Numeric input
- **Editable**: Yes

#### Revenue Budget (Text input)
- **Display**: "0.000"
- **Type**: Numeric input
- **Editable**: Yes

### Task Tabs Section (Below Task Information)

#### Available Tabs
1. **Comments** (active by default)
   - Rich text editor for adding comments
   - User avatar display
   - Comment formatting toolbar (Bold, Italic, Underline, Strikethrough, Font, Size, Color, Alignment, Lists, etc.)
   - Attachment section
   - Submit button (Ctrl+Enter)
   - Cancel button
   - View more comments link
   - Email-to-comment feature: "To add Task Comment via email" with email icon and email address (copyable)

2. **Subtasks**
   - List of associated subtasks
   - Create subtask option

3. **Log Hours**
   - Time tracking interface
   - Log work hours against task

4. **Documents**
   - Attached documents/files
   - Upload document option

5. **Dependency**
   - Task dependencies
   - Link related tasks

6. **Status Timeline**
   - Status change history
   - Timeline visualization

7. **Issues**
   - Associated issues
   - Link issues to task

8. **Activity Stream**
   - Complete activity log
   - Changes, comments, updates timeline

#### Available Extensions (dropdown)
- **SharePoint** - Install button
- **Checklist** - Install button

### Right Panel Header Controls

#### Top Bar Controls
- **Task Label**: Blue "Task" button
- **Task ID**: "T-1-11" (copy-to-clipboard)
- **More Actions** (three dots menu)
  - Task actions and options
- **Other buttons**:
  - View in full screen
  - Minimize/maximize
  - Close panel (X)

#### Navigation
- **Previous Task**: Left arrow button
- **Next Task**: Right arrow button

---

## Section 4: Task Status Options

### Available Status Values

| Status | Color | Indicator | Description |
|--------|-------|-----------|-------------|
| Open | Green | Green dot | Task is active and not completed |
| In Progress | Blue | Blue indicator | Work has started on task |
| On Hold | Yellow | Yellow indicator | Task is temporarily paused |
| Completed | Gray | Checkmark | Task has been finished |
| Cancelled | Red | Red indicator | Task has been cancelled |

### Status Behavior
- **Default Status**: Open (for new tasks)
- **Editable**: Yes (in both quick edit and detail view)
- **Change Triggers**: Status changes may trigger notifications and workflow automations
- **Status Timeline**: Captured and visible in Status Timeline tab
- **Bulk Edit**: Multiple tasks can have status changed from task list

---

## Section 5: Task Priority Options

### Available Priority Levels

| Priority | Color | Icon | Display |
|----------|-------|------|---------|
| None | Gray | Dash | No priority indicator (default) |
| Low | Light Blue | Down arrow | Lower precedence |
| Medium | Orange | Equal arrow | Standard priority |
| High | Red | Exclamation mark | High importance/urgency |

### Priority Features
- **Default Value**: "None"
- **Visual Indicator**: Color-coded display in list view and detail view
- **Sorting**: Can sort tasks by priority
- **Filtering**: Filter tasks by priority level
- **Quick Edit**: Can be changed inline from task list
- **Detail Edit**: Can be changed in task detail panel
- **Impact**: May affect task ordering in Kanban and other views
- **Notifications**: High priority tasks may trigger different notification behavior

---

## Additional Features & Controls

### Search & Filter Bar
- **Location**: Top of tasks page
- **Placeholder**: "Search"
- **Scope**: Searches task names and associated data
- **Advanced Filters**: Available via "Filters" button

### Keyboard Shortcuts
- **Ctrl+T**: Add new task
- **Ctrl+A**: Add new task list
- **Ctrl+Enter**: View task details (when task selected)
- **Ctrl+B**: Bold text in editor
- **Ctrl+I**: Italic text in editor
- **Ctrl+U**: Underline text in editor
- **Ctrl+Shift+↑**: Create task above
- **Ctrl+Shift+↓**: Create task below
- **Ctrl+Shift+X**: Strikethrough in editor

### Automation Features
- **Automation Button**: Configure automatic task actions
- **Recurring Tasks**: Set up repeating tasks with recurrence rules
- **Task Reminders**: Configure reminder notifications
- **Status Workflows**: Automate status transitions

### Integration Options
- **Google Calendar**: Sync tasks with Google Calendar
- **Google Tasks**: Create Google Tasks from Zoho tasks
- **Microsoft Outlook**: Sync with Outlook calendar
- **Microsoft Tasks**: Create Outlook tasks from Zoho tasks
- **Email Notifications**: Comment via email
- **Cliq Integration**: Task mentions and updates in Cliq

### View Customizations
- **Columns**: Add/remove columns from table view
- **Grouping**: Group by task list or other fields
- **Sorting**: Sort by any column
- **Filtering**: Filter by status, priority, owner, dates, etc.
- **Custom Views**: Save filtered and grouped views
- **Default View**: Set default view for team/user

### Performance & Display
- **Pagination**: Tasks paginated (6/6 visible)
- **Group Expansion**: Task lists are collapsible/expandable
- **Inline Editing**: Many fields editable directly in table
- **Batch Operations**: Select multiple tasks for bulk actions
- **Refresh Rate**: Data fetched on demand
- **Row Actions**: Quick action buttons on hover/select

---

## Notes on Data Types & Validation

### Text Fields
- Task Name: Required, max length varies
- Description: Rich text, optional
- Tags: Multiple text values

### Date Fields
- Format: mm-dd-yyyy
- Both start and due dates optional
- Completion date auto-set when task marked complete

### Numeric Fields
- Work Hours: HH:MM format
- Duration: Number with unit (days/hrs)
- Completion %: 0-100 range
- Budget fields: Decimal currency format
- Rates: Decimal format

### Dropdown/Select Fields
- Status: Single select from predefined list
- Priority: Single select from predefined list
- Owner: Single select from user list
- Associated Team: May support multiple selection
- Billing Type: Single select

### Date/Time Fields
- Timezone: Follows user/system settings
- Format: User locale dependent
- Validation: Invalid dates rejected

---

This documentation captures all visible UI elements, fields, and controls in the Zoho Projects Tasks section as of the current interface version (April 2026).

---

# PART 3: ISSUES MODULE

# Zoho Projects - Issues Section Comprehensive Reference Guide

**Project:** TaskFlow - Website Redesign
**Documentation Date:** April 10, 2026
**Application:** Zoho Projects

---

## Section 1: Issues List Page

### Overview
The Issues List page displays all issues for the project in a table format with multiple columns, filters, and action buttons. The page provides a comprehensive view of issue tracking and management.

### Top Navigation & Controls
- **Tab Name:** "Issues" (blue underline indicates current section)
- **Project Header:** Shows "TaskFlow - Website Redesign" with AI-1 project code
- **Breadcrumb:** Displays "All Issues" with dropdown filter

### Toolbar Actions (Top Right Area)
- **List View Button:** Icon to toggle between different view modes (currently on List view)
- **Submit Issues Button:** Large blue button labeled "Submit Issues" with tooltip showing "C + B" keyboard shortcut - used to create new issues
- **Filter Button:** Funnel icon for filtering issues
- **More Actions Menu:** Three-dot menu for additional options

### Table Columns (Left to Right)
1. **Checkbox Column** - For bulk selection of issues
2. **ID** - Auto-generated issue ID (e.g., T-1:1, T-1:2)
3. **Issues Name** - Title/name of the issue (clickable to open details)
4. **Reporter** - User who reported the issue (shows avatar and name)
5. **Created Date/Time** - Date and time the issue was created (format: MM-DD-YYYY HH:)
6. **Status** - Current status of the issue (color-coded badge, e.g., "Open" in teal/green)
7. **Tags** - Tags associated with the issue (if any)
8. **Assignee** - Person assigned to the issue (shows as "Unassigned" or user avatar/name)
9. **Due Date** - Due date for the issue (if set)
10. **Severity** - Severity level of the issue (e.g., "Major", "Critical", "Minor")

### Column Features
- **Sortable Columns:** ID, Created Date, Status, Due Date, Severity (indicated by up/down arrow icons in column headers)
- **Add Column Button:** "+" icon to add additional columns to the view
- **Column Resizing:** Columns can be resized by dragging column borders

### Issues Display Example
**Row 1:**
- ID: T-1:2
- Name: API response timeout on dashboard
- Reporter: Ankur Jain (avatar)
- Created: 04-10-2026 03:
- Status: Open (teal badge)
- Assignee: Unassigned
- Severity: Critical

**Row 2:**
- ID: T-1:1
- Name: Login page CSS broken on mobile
- Reporter: Ankur Jain (avatar)
- Created: 04-10-2026 03:
- Status: Open (teal badge)
- Assignee: Unassigned
- Severity: Major

### Row Actions
- **Click Issue Name:** Opens issue detail panel on the right side
- **Click Issue ID:** Opens issue detail panel on the right side
- **Click Expand Icon (after selection):** Shows additional options for the issue
- **Double-click Row:** Selects the row and may trigger detail view

### Additional UI Elements
- **Total Count Display:** Bottom right corner shows "Total Count: X" (e.g., "Total Count: 2")
- **Empty State Placeholder:** "Add Issues Name" placeholder text in empty rows
- **Row Selection Checkbox:** First column has checkboxes for bulk operations

### Filter Options
- **All Issues Dropdown:** Allows selecting different issue views or filters
- Indicates "All Issues" is the current filter selection

### Status Color Coding
- **Open Status:** Teal/green badge color indicating active/unresolved issues

---

## Section 2: Submit Issue Form (New Issues Creation)

### Form Header
- **Title:** "New Issues"
- **Project Name:** "TaskFlow - Website Redesign" (displayed in top right)
- **Close Button:** X icon to close the form

### Primary Fields

#### Issues Title (Required)
- **Field Type:** Text input
- **Placeholder:** Empty
- **Max Length:** Appears to be unlimited (tested with long titles)
- **Validation:** Required field
- **Label:** "Issues Title" with red asterisk indicating required
- **Example Values Entered:**
  - "Login page CSS broken on mobile"
  - "API response timeout on dashboard"

#### Description (Optional)
- **Field Type:** Rich text editor (WYSIWYG)
- **Placeholder:** Empty
- **Rich Text Toolbar Options:**
  - **Text Formatting:** Bold (B), Italic (I), Underline (U), Strikethrough (S), Code block
  - **Font Selection:** Dropdown for font family (e.g., "Puvi")
  - **Font Size:** Dropdown selector (default: 13)
  - **Font Color:** Color picker button
  - **Background Color:** Highlight/background color option
  - **Alignment:** Left, Center, Right, Justify alignment options
  - **Lists:** Bullet list, Numbered list, and list indent/outdent options
  - **Text Direction:** LTR/RTL toggle
  - **Line Spacing:** Line spacing adjustment options
  - **Script Options:** Superscript/Subscript buttons
  - **Insert Options:**
    - Insert Image
    - Insert Code block
    - Insert Link (Ctrl+K shortcut)
    - Insert HTML
    - Edit HTML
  - **AI/Auto-complete:** Generate content button (AI-powered)
  - **Expand Editor:** Full-screen editor expansion button
  - **Accessibility:** Switchbox option for accessibility features
- **Text Editor Area:** Large text input area below toolbar for content entry
- **Character Count:** Appears to have no visible limit indicator

### Attachments Section
- **Label:** "Drop files or add attachments here..."
- **Maximum Files:** "Maximum 10 files"
- **Upload Method:** Drag and drop or click to browse
- **File Types:** Appears to accept any file type (not explicitly limited in UI)

### Reminder Options (Optional)
- **Label:** "Reminder options" with info icon (tooltip: "A reminder mail will be sent to the specified users on or before the due date. A reminder mail wil...")
- **Default Value:** "None"
- **Dropdown Type:** Combobox
- **Options:**
  - None
  - Based on due date:
  - Specific date:
- **Tooltip Notes:**
  - "Based on due date:" - Sends reminder based on the due date set
  - "Specific date:" - Allows setting a specific date for the reminder

### Add Followers (Optional)
- **Label:** "Add Followers"
- **Field Type:** Dropdown/Combobox with search capability
- **Placeholder:** "Select"
- **Description:** Allows adding team members as followers to the issue

### Issues Information Section (Expandable)
- **Section Header:** "Issues Information" with chevron icon (expandable/collapsible)
- **Default State:** Expanded

#### Associated Team (Optional)
- **Label:** "Associated Team"
- **Field Type:** Dropdown/Combobox
- **Default Value:** "Select"
- **Options:** Dropdown list of available teams
- **Required:** No

#### Assignee (Optional)
- **Label:** "Assignee" with info icon
- **Field Type:** Dropdown/Combobox
- **Default Value:** "Select"
- **Options:** Dropdown list of available users
- **Required:** No
- **Tooltip:** "To assign external Issues to client users, configure client permissions under the respective Issues..."
- **Example:** Can select team members to assign the issue

#### Tags (Optional)
- **Label:** "Tags"
- **Field Type:** Tag input with creation capability
- **Placeholder:** "Enter a tag name"
- **Features:**
  - Type to search existing tags
  - Create new tags by typing and confirming
  - Color selection for custom tags
  - Multiple tag selection
  - Tag creation with "Create" button

#### Due Date (Optional)
- **Label:** "Due Date"
- **Field Type:** Date picker
- **Placeholder:** Empty
- **Input Method:** Click to open date picker or type date
- **Icon:** Calendar icon for date picker activation

#### Severity (Critical Field)
- **Label:** "Severity"
- **Field Type:** Dropdown/Combobox
- **Default Value:** "None"
- **Options Available:**
  1. **None** - No severity assigned
  2. **Show stopper** - Highest priority, blocking all work
  3. **Critical** - Critical issue requiring immediate attention
  4. **Major** - Major issue, significant impact
  5. **Minor** - Minor issue, low impact
- **Sortable:** Yes, shows in list view and can be used for sorting

#### Release Phase (Optional)
- **Label:** "Release Phase" with info icon
- **Field Type:** Dropdown/Combobox
- **Default Value:** "None"
- **Options:** List of available release phases

#### Affected Phase (Optional)
- **Label:** "Affected Phase" with info icon
- **Field Type:** Dropdown/Combobox
- **Default Value:** "None"
- **Options:** List of available phases affected by the issue

#### Module (Optional)
- **Label:** "Module"
- **Field Type:** Dropdown/Combobox
- **Default Value:** "None"
- **Options:** List of available modules/components

#### Classification (Optional)
- **Label:** "Classification"
- **Field Type:** Dropdown/Combobox
- **Default Value:** "None"
- **Options:** Classification types for the issue

#### Reproducible (Optional)
- **Label:** "Reproducible"
- **Field Type:** Dropdown/Combobox
- **Default Value:** "None"
- **Options:** Reproducibility indicators for bugs

#### Flag (Optional)
- **Label:** "Flag"
- **Field Type:** Dropdown/Combobox
- **Default Value:** "Internal"
- **Options:**
  - Internal (default) - Issue is internal only
  - (Other flag options available in dropdown)

### Form Action Buttons (Bottom)
- **Add Button (Primary)** - Blue button to submit and create the issue
- **Add More Button (Secondary)** - Create another issue after this one
- **Cancel Button (Tertiary)** - Close the form without saving

### Form Behavior
- **Validation:** Requires at least the Issues Title to be filled
- **Auto-save:** Appears to auto-save field values if form loses focus
- **Field Dependencies:** Some fields may be conditional based on other selections

---

## Section 3: Issue Detail View

### Detail Panel Header
- **Panel Title:** Shows issue ID and number (e.g., "T-1:1")
- **Issue Title:** Main title displayed prominently (e.g., "Login page CSS broken on mobile")
- **Reporter Info:** "By Ankur Jain" with user avatar
- **Reporter Indicators:**
  - Icon links for additional actions
  - Info icon
  - Reporter name clickable

### Quick Status Display
- **Current Status Indicator:** Green badge showing current status (e.g., "Open")
- **Status Label:** "CURRENT STATUS" text label above status badge
- **Status Dropdown:** Click status badge to change status

### Detail Panel Actions (Top Right)
- **Three-dot Menu Button:** Additional actions menu
- **Icon Buttons:**
  - Expand/full-screen button
  - Split view button
  - Close panel button (X)

### Main Content Sections

#### Description Section
- **Section Header:** "Description" with collapse/expand chevron and + add button
- **Default State:** Collapsed or showing "NO DESCRIPTION AVAILABLE"
- **Edit Capability:** Click + button to add/edit description

#### Issues Information Section (Left Column)
- **Section Header:** "Issues Information" with collapse/expand chevron
- **Default State:** Expanded

**Fields Displayed (Read-only or Editable):**
- **Associated Team**
  - Value: "Not Associated" (clickable for edit)
  - Edit triggers dropdown selection

- **Assignee**
  - Value: "Unassigned" (clickable for edit)
  - Info icon with tooltip
  - Dropdown to select assignees

- **Tags**
  - Value: (empty if no tags)
  - Editable

- **Reminder**
  - Value: "None" (with collapsible options)
  - Info icon with tooltip
  - Options: "Based on due date:", "Specific date:"

- **Due Date**
  - Value: (empty if not set)
  - Calendar icon for date picker
  - Editable field

- **Status**
  - Value: "Open" (with green indicator dot)
  - Dropdown to change status
  - Currently shows "CURRENT STATUS"

- **Severity**
  - Value: "Major" or "Critical" (depends on issue)
  - Dropdown to change severity
  - Severity levels displayed as text

- **Release Phase**
  - Value: "None"
  - Info icon with tooltip
  - Dropdown to select phase

- **Affected Phase**
  - Value: "None"
  - Info icon with tooltip
  - Dropdown to select phase

- **Module**
  - Value: "None"
  - Dropdown to select module

- **Classification**
  - Value: "None"
  - Dropdown to select classification

- **Reproducible**
  - Value: "None"
  - Dropdown to select reproducibility

- **Flag**
  - Value: "Internal"
  - Dropdown to change flag

### Detail Tabs Section (Bottom of Panel)

#### Tabs Available (Horizontal Tab Bar)
1. **Comments** (Default/First Tab)
   - Comment thread display area
   - Rich text editor for adding comments
   - User avatar with initial (e.g., "A" for Ankur)
   - Formatting toolbar for comments (Bold, Italic, Underline, Strikethrough, Font, Size, Color, Alignment, Lists, etc.)
   - "To add issues Comment via email" link with icon

2. **Attachments**
   - Display attached files
   - Upload area for new attachments

3. **Log Hours**
   - Time logging interface
   - Track work hours spent on the issue

4. **Link Issues**
   - Link related issues
   - Show issue relationships/dependencies

5. **Resolution**
   - Resolution tracking
   - Resolution status and notes

6. **Tasks**
   - Subtasks or related tasks
   - Task management for the issue

7. **Status Timeline**
   - History of status changes
   - Timeline view of issue progression

8. **Activity Stream**
   - Complete activity log
   - All changes and updates to the issue

9. **More** (...)
   - Additional tabs or options
   - May include custom tabs or additional features

### Comment Editor Features
- **User Avatar:** Shows comment author's avatar with initial
- **Formatting Options:**
  - Bold, Italic, Underline, Strikethrough buttons
  - Font family selector
  - Font size selector (13 default)
  - Font color button
  - Background/highlight color button
  - Alignment options (left, center, right, justify)
  - List options (bullet, numbered)
  - Indent/outdent buttons
  - Script options (superscript, subscript)
  - Link insertion (Ctrl+K)
  - Other formatting tools
- **Large Text Area:** For entering comment text
- **Additional Tools:** Icons for more formatting options

### Detail Panel Footer
- **Shortcuts Hint:** "To add issues Comment via email" with link icon
- **Close/Action Indicators:** Various action states and buttons

### Detail Panel Behavior
- **Open Trigger:** Click on issue ID, issue name, or expand icon in list
- **Auto-scroll:** Scrolls to show relevant fields and tabs
- **Field Editing:** Click on field values to edit them (most fields)
- **Real-time Updates:** Changes appear immediately in both detail and list views
- **Responsive Layout:** Panel adjusts to available space

---

## Section 4: Issue Status Options

### Available Status Values

1. **Open** (Default)
   - **Color Indicator:** Teal/Green badge
   - **Description:** Issue is active and unresolved
   - **Use Case:** Active issues waiting to be worked on or in progress
   - **Transition:** Can transition to In Progress, Closed, or other statuses
   - **Display:** Shows with green/teal dot indicator

2. **In Progress** (If available)
   - **Description:** Issue is currently being worked on
   - **Use Case:** When a team member is actively working on the issue

3. **Closed** (If available)
   - **Description:** Issue has been resolved and is closed
   - **Use Case:** When the issue has been fixed or is no longer relevant

4. **On Hold** (If available)
   - **Description:** Issue is temporarily paused
   - **Use Case:** Waiting for additional information or external dependencies

5. **Reopened** (If available)
   - **Description:** Previously closed issue has been reopened
   - **Use Case:** When a closed issue resurfaces

### Status Change Method
- **Dropdown Interaction:** Click on the status badge to open dropdown
- **Dropdown Location:** Displayed in the Issues Information section or status area
- **Selection:** Click desired status to change
- **Confirmation:** Automatic - status updates immediately

### Status Attributes
- **Tracked:** Status is logged in Status Timeline tab
- **Required Field:** Status always has a value (cannot be blank)
- **Default for New Issues:** "Open"

---

## Section 5: Issue Severity Options

### Severity Levels (in order of priority)

1. **None**
   - **Default Value:** Yes (for new issues if not specified)
   - **Description:** No severity assigned
   - **Priority Level:** 0 (lowest/not specified)
   - **Typical Use:** When severity needs to be determined later
   - **Color/Badge:** Usually neutral or gray
   - **Selection Order in Dropdown:** First option

2. **Minor**
   - **Priority Level:** 1 (lowest active severity)
   - **Description:** Low-impact issue with minimal impact on functionality
   - **Use Cases:**
     - Cosmetic issues
     - Non-critical UI improvements
     - Low-priority bugs
   - **Impact:** Limited or no impact on core functionality
   - **Response Time:** Can be addressed in regular maintenance cycles
   - **Selection Order in Dropdown:** Last option

3. **Major**
   - **Priority Level:** 2 (medium-high severity)
   - **Description:** Significant issue with notable impact
   - **Use Cases:**
     - Feature breaks
     - Significant functionality issues
     - Moderate performance problems
   - **Impact:** Affects important features or user experience
   - **Response Time:** Should be addressed in current or next sprint
   - **Example Issue:** "Login page CSS broken on mobile" (Major severity)
   - **Selection Order in Dropdown:** Fourth option

4. **Critical**
   - **Priority Level:** 3 (high severity)
   - **Description:** Critical issue requiring immediate attention
   - **Use Cases:**
     - Data loss or corruption
     - Security vulnerabilities
     - Complete feature unavailability
     - System crashes
   - **Impact:** Significant impact on system functionality or user data
   - **Response Time:** Requires immediate attention and fix
   - **Example Issue:** "API response timeout on dashboard" (Critical severity)
   - **Selection Order in Dropdown:** Third option

5. **Show stopper**
   - **Priority Level:** 4 (highest severity)
   - **Description:** Blocking issue preventing all work or deployment
   - **Use Cases:**
     - Deployment blockers
     - Complete system unavailability
     - Critical data loss scenarios
     - Security breaches
   - **Impact:** Prevents deployment, blocks all users, or causes critical failures
   - **Response Time:** Emergency - requires immediate resolution before any release
   - **Selection Order in Dropdown:** Second option

### Severity Features
- **Sortable Column:** Issues can be sorted by severity in the list view
- **Filter Capability:** Can likely filter issues by severity level
- **Searchable:** Part of the searchable/filterable issue attributes
- **Dropdown Format:** Presented as a dropdown/combobox in forms and detail views
- **Color Coding:** Different severity levels may have different color indicators in the UI
- **Default on Create:** "None" (shown when creating new issue)

### Severity Use in Reporting
- **List View:** Displayed in "Severity" column, rightmost in the issue list
- **Detail View:** Shown in Issues Information section as editable field
- **Sorting:** Click column header to sort by severity
- **Filtering:** Available in filter options to show only certain severity levels

---

## Section 6: Issue Workflow (Status Transitions and Resolution Flow)

### Typical Issue Lifecycle

#### Phase 1: Issue Creation
```
Start (Issue Submitted) → Status: "Open"
```
- Issues are created with status "Open"
- All fields are initially set to defaults (Severity: None, Assignee: Unassigned, etc.)
- Initial reporter is automatically recorded

#### Phase 2: Issue Triage & Assignment
```
Open → Assignment & Configuration
```
**Actions:**
- Assign the issue to a team member (Assignee field)
- Set appropriate Severity (None → Minor, Major, Critical, Show stopper)
- Add to a Release Phase if applicable
- Associate with affected Module
- Add Tags for categorization
- Set Due Date if needed
- Update Classification

**Fields Updated:**
- Assignee: "Unassigned" → Team member name
- Severity: "None" → Appropriate level
- Tags: Added relevant tags
- Due Date: Set deadline if applicable

#### Phase 3: Issue Resolution (Active Work)
```
Open → In Progress (if applicable) → Resolution
```
**Activities:**
- Team member works on the issue
- Comments added to track progress
- Hours logged in "Log Hours" tab
- Related tasks or subtasks may be created
- Status may change to "In Progress" if available

**Tracked Information:**
- Activity Stream updated with all changes
- Comments section shows discussion
- Status Timeline records all status changes
- Time Log records work effort

#### Phase 4: Resolution & Closure
```
Open/In Progress → Closed
```
**Resolution Actions:**
- Complete the issue fix/resolution
- Add final comments documenting the resolution
- Fill in Resolution tab details
- Log final time entries if applicable
- Change status to "Closed"

**Closure Recorded:**
- Status Timeline shows closure timestamp
- Activity Stream logs the closure
- Issue remains queryable/filterable but marked as closed

#### Phase 5: Post-Closure (if needed)
```
Closed → Reopened (if issue resurfaces)
```
**Reopening Scenario:**
- Issue previously closed but problem resurfaces
- Change status back to "Open"
- Add comment explaining why reopened
- May update Severity or other fields
- Status Timeline records the reopening

### Status Transition Flow Diagram
```
┌─────────────┐
│    OPEN     │ (Default for new issues)
└──────┬──────┘
       │
       ├─────→ IN PROGRESS (if available)
       │           │
       │           └─────→ ┌───────────┐
       │                   │  CLOSED   │
       │                   └─────┬─────┘
       │                         │
       └────────────────────────→ CLOSED
       │
       └─────→ ON HOLD (optional)
               │
               └─────→ OPEN (resume work)
       │
       └─────→ REOPENED (if closed issue resurfaces)
               │
               └─────→ OPEN
```

### Field State Through Workflow

#### State at Creation
- Status: "Open"
- Severity: "None"
- Assignee: "Unassigned"
- Description: (optional)
- Due Date: (optional)
- Associated Team: "Not Associated"
- Release Phase: "None"
- Affected Phase: "None"
- Module: "None"
- Classification: "None"
- Reproducible: "None"
- Flag: "Internal"
- Created Date: Current date/time
- Reporter: Current user
- Total Count: Issue added to total count

#### State During Assignment
- Status: Remains "Open"
- Severity: Updated to appropriate level
- Assignee: Updated to selected team member
- Due Date: Set if applicable
- Associated Team: Assigned if applicable
- Other fields: Updated as needed

#### State During Resolution
- Status: May change to "In Progress"
- Comments: Accumulate in Comments tab
- Activity Stream: Records all changes
- Log Hours: Records time spent
- Status Timeline: Records status changes
- Related Issues: May be linked
- Tasks: Subtasks may be created/updated

#### State After Closure
- Status: "Closed"
- Status Timeline: Shows closure date/time
- Activity Stream: Shows closure action
- Issue remains accessible: For historical reference
- Can be reopened: If needed

### Status Timeline Tab
**Records:**
- Each status change with timestamp
- User who made the change
- Date and time of transition
- Complete history from creation to closure
- Any status reopenings

**Example Timeline Entry:**
- 04-10-2026 03:00:00 - Status changed to "Open" by Ankur Jain (on issue creation)
- 04-10-2026 04:30:00 - Status changed to "In Progress" by [Team Member] (when work begins)
- 04-10-2026 06:00:00 - Status changed to "Closed" by [Team Member] (when resolved)

### Activity Stream Tab
**Tracks:**
- All field changes (Assignee, Severity, Due Date, etc.)
- Comments added
- Status transitions
- Related issues links
- Time entries
- Description updates
- Attachments added
- Any other modifications

**Format:**
- Chronological list of all activities
- Timestamp for each activity
- User who made the change
- Description of the change

### Comments During Workflow
**Comment Sections Available At:**
- Anytime during the issue lifecycle
- Triage phase: Questions or clarifications
- Resolution phase: Progress updates
- Closure: Final notes or handoff documentation

**Rich Text Support:**
- Comments use same rich text editor as Description
- Can include formatting, links, code blocks, etc.
- Can @ mention team members for notifications

### Issue Resolution Process Example

**Scenario: "Login page CSS broken on mobile" (Major Severity)**

1. **Creation (04-10-2026 03:00)**
   - Status: Open
   - Severity: Major
   - Assignee: Unassigned
   - Reporter: Ankur Jain

2. **Triage (04-10-2026 03:30)**
   - Assigned to: Frontend Developer
   - Added Tag: "Mobile"
   - Due Date: 04-12-2026
   - Module: Login Page
   - Status: Still Open (no status changed)

3. **Work Started (04-10-2026 04:00)**
   - Status: In Progress
   - Comment: "Starting work on mobile CSS issues"
   - Activity Stream: Logged

4. **During Resolution (04-10-2026 05:00)**
   - Comment: "Identified CSS media query issue"
   - Log Hours: 1 hour work
   - Activity Stream: Shows 1 hour logged

5. **Resolution Complete (04-10-2026 06:00)**
   - Status: Closed
   - Comment: "Fixed CSS breakpoints for mobile, tested on iOS and Android"
   - Log Hours: Total 2 hours
   - Resolution Tab: Filled with resolution details
   - Status Timeline: Shows "Closed at 04-10-2026 06:00 by Frontend Developer"

6. **Post-Resolution**
   - Issue available for reference
   - Can be reopened if issue resurfaces
   - Metrics tracked for reporting

### Resolution Tab Details
**Typical Fields:**
- Resolution Type: (Fixed, Won't Fix, Duplicate, Deferred, etc.)
- Resolution Date: Auto-filled with closure date
- Resolver: Shows the user who closed the issue
- Resolution Notes: Additional details about the fix
- Related Issues: Links to duplicate or related issues

### Workflow Automation (if available)
**Possible Automated Triggers:**
- Auto-assign to module owner
- Auto-set due date based on severity
- Notify stakeholders on status change
- Auto-close based on time without updates
- Auto-log hours based on timestamps

### Metrics Tracked Through Workflow
- **Time to Assignment:** Time from creation to assignment
- **Time to Resolution:** Time from creation to closure
- **Status Change Frequency:** Number of status transitions
- **Reopening Rate:** Frequency of issues being reopened
- **Severity Distribution:** Issues by severity level
- **Assignee Workload:** Number of open issues per assignee

---

## Additional UI Features & Interactions

### Keyboard Shortcuts
- **C + B:** Opens "Submit Issues" dialog
- **Ctrl + K:** Insert link in rich text editor (Comments and Description)
- **Ctrl + B:** Bold text
- **Ctrl + I:** Italic text
- **Ctrl + U:** Underline text

### Right-Click Context Menus
- Likely available on issue rows for quick actions
- Possible options: Edit, Delete, Copy Link, Share, etc.

### Search/Filter Functionality
- **All Issues Dropdown:** Filter view selection
- **Potential Filters:**
  - By Status
  - By Severity
  - By Assignee
  - By Reporter
  - By Date Range
  - By Tags
  - By Module

### Bulk Operations
- **Checkbox Selection:** Select multiple issues
- **Clear Button:** Clears all selections
- **Potential Bulk Actions:**
  - Change Status for multiple issues
  - Change Severity for multiple issues
  - Assign to team member
  - Add Tags
  - Export/Download

### Report & Analytics
- **Total Count:** Displayed in bottom right (e.g., "Total Count: 2")
- **Issue Metrics:**
  - Open vs. Closed counts
  - Severity distribution
  - Assignee workload
  - Time to resolution

---

## Tips for Effective Issue Management

1. **Always Set Severity:** Helps prioritize work appropriately
2. **Assign Quickly:** Reduce unassigned issue count
3. **Add Due Dates:** For time-sensitive issues
4. **Use Tags:** For categorization and filtering
5. **Comment Regularly:** Keep stakeholders informed of progress
6. **Log Hours:** Track actual time spent for better estimation
7. **Link Related Issues:** Maintain issue relationships
8. **Update Status:** Keep status current to reflect actual state
9. **Attach Evidence:** Include screenshots or logs when relevant
10. **Close When Done:** Don't leave issues in "In Progress" indefinitely

---

## Common Issue Management Scenarios

### Bug Report
- Severity: Critical or Major (depending on impact)
- Module: The affected component
- Classification: Bug
- Reproducible: Yes (if reproducible), No (if intermittent)
- Include: Steps to reproduce, expected vs. actual behavior, screenshots

### Feature Request
- Severity: Minor (typically)
- Classification: Feature Request
- Due Date: Set if there's a target release
- Description: Detailed requirements and use cases

### Performance Issue
- Severity: Major or Critical (depends on impact)
- Classification: Performance
- Log Hours: To track investigation time
- Comments: Include performance metrics and profiling results

### Security Issue
- Severity: Show stopper (typically)
- Flag: Internal or escalated based on policies
- Classification: Security
- Keep description detailed but don't expose sensitive information

---

## Document Version History

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 04-10-2026 | Initial comprehensive documentation based on Zoho Projects Issues section exploration |

---

**End of Documentation**

*This document provides a complete reference for using Zoho Projects' Issues section, including all UI elements, fields, workflows, and best practices.*

---

# PART 4: PHASES & TIME LOGS MODULE

# Zoho Projects - Phases and Time Logs Reference Guide

Comprehensive documentation for Phases and Time Logs sections in Zoho Projects.

---

## SECTION 1: PHASES LIST PAGE

### Location
Main menu > Phases (or sidebar: Overview > Phases)

### Page Layout
- **Header**: "Phases" title with navigation
- **Top Controls**:
  - "Group By None" dropdown - organize phases by criteria
  - "All Phases" filter - view different phase sets
  - View toggle buttons (List, Gantt chart options)
  - "Add Phase" button (blue) - create new phases
  - Keyboard shortcut: C + M

### List View Features

#### Columns Displayed
| Column | Description |
|--------|-------------|
| Phase Name | Name of the project phase |
| Project | Associated project ID/name |
| % | Completion percentage (based on completed tasks/issues) |
| Status | Current status of the phase |
| Owner | Person responsible for the phase |
| Start Date | When the phase begins |
| End Date | When the phase concludes |
| Tasks | Number of tasks in the phase |
| Issues | Number of issues in the phase |

#### Column Features
- Column headers are sortable
- Right-click context menu available
- "Add Column" option to customize view
- Horizontal scroll to see all columns

### View Options
- **List View**: Default tabular display
- **Gantt Chart**: Timeline visualization
- **Group By**: Options to group phases by:
  - Date
  - Project
  - Status
  - Owner
  - Custom fields

### Filtering and Search
- **Search bar**: Search by phase name
- **Predefined Views**:
  - All Phases
  - Active (ongoing phases)
  - Completed (finished phases)
  - Overdue & Open
  - Due this week
  - Due this month
  - Unassigned phases
- **Custom Views**: Create and save custom filters
- **Favorite Views**: Mark frequently used views as favorites

### Action Buttons
- **Add Phase** - Create new phase
- **Filters** - Apply custom filters
- **Other Actions** - More options (export, bulk actions)
- **Help** - Context help

### Date Navigation
- Date range selector: Shows week/month view (e.g., "04-05-2026 to 04-11-2026 (WEEK - 15)")
- Previous/Next buttons for date navigation
- Week number indicator

### Inline Editing
- Click "Add Phase" row to edit inline
- Fields available in inline mode:
  - Phase Name (required, text field)
  - Project (dropdown selector)
- After creating, click to open full form for additional fields

---

## SECTION 2: ADD PHASE FORM (Full Detail View)

### Access Method
Click "Add Phase" button in top right of Phases list page

### Form Title
"New Phase"

### Form Layout
Modal dialog with the following sections:

### Basic Information

#### Project (Required)
- **Type**: Dropdown selector
- **Options**: List of all available projects
- **Example**: "TaskFlow - Website Redesign"
- **Behavior**: Once selected, cannot be changed during inline creation
- Note: Project link available in top right corner

#### Phase Name (Required)
- **Type**: Text input field
- **Placeholder**: Empty
- **Max length**: Not documented (appears to accept full phase names)
- **Example**: "Phase 1 - Discovery and Planning"

#### Clone from Existing Phase
- **Type**: Checkbox
- **Default**: Unchecked
- **Function**: Copies configuration from an existing phase

### Phase Information Section
(Expandable/collapsible section)

#### Owner (Optional)
- **Type**: Dropdown selector
- **Default Value**: "Unassigned"
- **Options**: Team members with access to project
- **Function**: Assign responsibility for phase

#### Start Date (Required)
- **Type**: Date picker input field
- **Format**: DD-MM-YYYY (e.g., "01-04-2026")
- **Default**: Current date
- **Clear button**: Available to reset
- **Calendar picker**: Click icon to select from calendar

#### End Date (Required)
- **Type**: Date picker input field
- **Format**: DD-MM-YYYY (e.g., "30-04-2026")
- **Default**: Current date
- **Clear button**: Available to reset
- **Calendar picker**: Click icon to select from calendar
- **Validation**: Typically must be >= Start Date

#### Flag (Optional)
- **Type**: Dropdown selector
- **Default Value**: "Internal"
- **Options**:
  - Internal (default)
  - External
  - Critical
  - (Other custom flags based on configuration)
- **Function**: Mark phase visibility/importance level

#### Tags (Optional)
- **Type**: Dropdown/multi-select field
- **Placeholder**: "Enter a tag name"
- **Function**: Add category tags to phase for organization
- **Behavior**: Type to search or create new tags

### Form Buttons

#### Save Options
1. **Add** (Blue button)
   - Saves single phase
   - Closes form on success
   - Keyboard shortcut: Ctrl + Enter

2. **Add More** (Secondary button)
   - Saves current phase and keeps form open
   - Allows quick creation of multiple phases

3. **Cancel** (Secondary button)
   - Closes form without saving
   - Discards all entered data

### Form Validation
- **Project**: Required - must select a project
- **Phase Name**: Required - must enter phase name
- **Start Date**: Required - must enter valid date
- **End Date**: Required - must enter valid date
- **End Date >= Start Date**: Validation rule

### Form Behavior
- Form expands to show "Phase Information" section after project selection
- All required fields marked with red asterisk (*)
- Form remains open on validation error
- Success message displays after creation

---

## SECTION 3: PHASE DETAIL VIEW

### Access Method
Click on phase name in list to open detail view

### Detail View Tabs
(Based on typical project management patterns)
- Overview/Summary
- Tasks (linked to phase)
- Issues (linked to phase)
- Timeline
- Documents (if applicable)
- Activity/Comments

### Detail View Fields
Display all fields from creation form plus:
- **ID**: Unique phase identifier
- **Status**: Current approval/completion status
- **Progress**: Visual progress bar (task/issue completion percentage)
- **Created By**: User who created the phase
- **Created Date**: When phase was created
- **Modified By**: Last user to modify
- **Modified Date**: Last modification timestamp
- **Duration**: Calculated days between start and end date

### Actions Available
- **Edit Phase**: Modify phase details
- **Delete Phase**: Remove phase (if no dependent items)
- **Add Task**: Create task within phase
- **Add Issue**: Create issue within phase
- **Export**: Download phase details
- **More Actions**: Additional options

---

## SECTION 4: TIME LOGS LIST PAGE

### Location
Project > Time Logs tab (or sidebar: Overview > Time Logs)

### Page Header
- **Project Name**: "AI-1 TaskFlow - Website Redesign"
- **Active Tab**: "Time Logs" (highlighted in blue)
- **Other Tabs**: Dashboard, Tasks, Users, Reports, Documents, Phases, Issues, Timesheet

### Date Range Controls

#### Week/Period Selector
- **Format**: "04-05-2026 to 04-11-2026 (WEEK - 15)"
- **Navigation Buttons**:
  - Previous arrow button
  - Week/period display (clickable for calendar)
  - Next arrow button
- **Function**: Change date range for time log view

#### Time Period Display
- **Default**: Current week
- **View Indicator**: Shows week number (WEEK - 15)
- **Date Format**: DD-MM-YYYY

### View Controls

#### View Options
- **List** (default): Tabular display of time logs
- **Weekly Time Log**: Calendar-style weekly view
- **Other options**: May include daily/monthly views

### Group By
- **Group By Date** (default): Organizes logs by date
- Dropdown to change grouping criteria

### Action Buttons
- **Automation** button: Set up automated time log rules
- **Add Time Log** button (blue, top right): Create new time log entry
  - Keyboard shortcut: C + L
  - Dropdown arrow for quick add options

### Filters and Views
- **Group By Date** dropdown: Change grouping
- **All Time Logs** filter: Select different view sets
- **Favorite icon**: Mark view as favorite
- **Data last fetched**: Shows cache timestamp (e.g., "Friday, 04-10-2026 at 03:04 AM")
- **More Actions**: View management options

### List Columns

| Column | Description |
|--------|-------------|
| ID | Time log entry identifier |
| Log Title | Name/title of the time log entry |
| Timesheet Name | Associated timesheet (if any) |
| Daily Log Hours | Hours logged on that day |
| Time Period | Start and end time of logged work |
| User | Person who logged the time |
| Billing Type | How hours are billed (see Section 7) |
| Approval Status | Current approval state |
| Notes | Additional comments/details |
| Created By | User who created entry |

### Additional UI Elements
- **Checkbox column**: Select multiple entries for bulk actions
- **Collapse/Expand**: Expand date groups to see individual entries
- **Profile badges**: User avatars next to names
- **"Add Time Log" inline**: Create entry directly in table

### Default Display
- Empty state shows "Add Time Log" option
- Current user (e.g., "Ankur Jain") displayed with avatar
- Week view by default (current or selected week)

---

## SECTION 5: ADD TIME LOG FORM

### Access Method
Click "Add Time Log" button from Time Logs list page
- Opens modal dialog with time log form

### Form Title
"New Time Log" or similar

### Form Fields

#### Time Log Entry (Required)
- **Type**: Text input
- **Placeholder**: Enter log title
- **Example**: "Frontend Development", "Design Review", "Client Meeting"
- **Function**: Name/title of the work done

#### Task Association (Optional)
- **Type**: Dropdown/searchable field
- **Options**: List of tasks in project
- **Function**: Link time log to specific task
- **Behavior**: Limits to tasks in current project

#### Date (Required)
- **Type**: Date picker
- **Format**: DD-MM-YYYY
- **Default**: Today's date
- **Function**: Date when work was performed

#### Time Period (Required)
- **Type**: Time range picker
  - Start Time: Hour and minute selector
  - End Time: Hour and minute selector
- **Format**: HH:MM (24-hour or 12-hour based on settings)
- **Function**: Record specific time spent
- **Auto-calculation**: System calculates hours from times

#### Hours (Required/Auto-calculated)
- **Type**: Numeric field or auto-calculated
- **Decimal places**: Up to 2 (e.g., 8.5)
- **Function**: Total hours for this log entry
- **Calculation**: Derived from Time Period if not entered manually

#### Billing Type (Required)
- **Type**: Dropdown selector
- **Options**: (See Section 7 for complete list)
  - Billable
  - Non-billable
  - Optional
  - (Other custom types)
- **Default**: Based on project/task settings
- **Function**: Determine how hours are charged

#### Notes/Description (Optional)
- **Type**: Text area (multi-line)
- **Placeholder**: Optional notes or details
- **Function**: Add context or details about work performed
- **Common Use**: Project-specific notes, blockers, achievements

#### Approval Status (Optional/Auto-set)
- **Type**: Status field (may be read-only on creation)
- **Options**: (See Section 7)
  - Pending
  - Approved
  - Rejected
- **Default**: "Pending" (awaiting approval)
- **Auto-approval**: May auto-approve based on settings

### Additional Options (Conditional)

#### Assign to Timesheet (Optional)
- **Type**: Checkbox or automatic
- **Function**: Include in timesheet group

#### Billable Hours Override (Conditional)
- **Type**: Numeric field
- **Visibility**: Only if billing type is "Billable"
- **Function**: Override calculated billable hours

### Form Buttons

#### Save Actions
1. **Save/Submit** (Blue button)
   - Saves time log entry
   - Routes to approval if required
   - Closes form on success

2. **Save & Continue** (Secondary)
   - Saves and keeps form open for next entry
   - Useful for bulk entry

3. **Cancel** (Secondary)
   - Discards unsaved data
   - Closes form

### Validation Rules
- Date: Required, must be valid date
- Time Period: Required, start time < end time
- Hours: Required, must be > 0
- Billing Type: Required
- Task: Optional but improves tracking

### Form Behavior
- Time/hours fields auto-populate if time period selected
- Task dropdown filters by project
- Approval routing triggered on submit
- Email notification sent to approvers (if configured)

---

## SECTION 6: TIME LOG DETAIL VIEW

### Access Method
Click on any time log entry in the list

### Detail View Layout

#### Header Information
- **Log Title**: Name of the time log
- **Date**: Date of work performed
- **User**: Person who logged time
- **Status Badge**: Approval status indicator

#### Core Fields Display
- **Task**: Linked task (if associated)
- **Time Period**: From HH:MM to HH:MM
- **Duration/Hours**: Total hours logged
- **Billing Type**: How hours are classified

#### Additional Details
- **Created By**: Original creator
- **Created Date**: When entry was created
- **Modified By**: Last editor
- **Modified Date**: Last modification time
- **Approval History**: Who approved/rejected and when

### Detail View Sections

#### Activity/Comments Section
- View comments from approvers
- Add replies or notes
- Audit trail of changes

#### Attachments (if applicable)
- View/upload evidence of work (screenshots, files)
- Attachment history

#### Related Items
- Linked task details
- Linked timesheet
- Related time logs

### Actions Available
- **Edit**: Modify entry details
- **Delete**: Remove entry (if not approved)
- **Approve**: Approve entry (if permission granted)
- **Reject**: Reject entry (if permission granted)
- **Reassign**: Change approver or owner
- **Download**: Export entry details
- **Print**: Print entry

---

## SECTION 7: BILLING TYPES AND APPROVAL STATUSES

### Billing Types

#### Standard Billing Types
1. **Billable**
   - **Description**: Hours charged to client/project
   - **Tracking**: Full hours recorded
   - **Reporting**: Included in billing reports
   - **Calculation**: Contributes to invoiceable hours
   - **Example Use**: Development work on deliverables

2. **Non-billable**
   - **Description**: Hours not charged to client
   - **Tracking**: Tracked but excluded from billing
   - **Reporting**: Appears in internal reports only
   - **Calculation**: Does not contribute to billable hours
   - **Example Use**: Internal meetings, training, admin work

3. **Optional**
   - **Description**: Hours that may be billable
   - **Tracking**: Recorded as conditional
   - **Reporting**: Separate line item in reports
   - **Approval**: Requires manager discretion to bill
   - **Example Use**: Uncertain scope work, waiting on approval

#### Custom Billing Types
- Organizations may define additional types
- Examples: "Pro Bono", "Internal", "Research", "Support"
- Configuration: Set up in project or organization settings

### Approval Statuses

#### Status Workflow
1. **Draft**
   - **Description**: Entry being created/edited
   - **Permissions**: Creator can edit freely
   - **Visibility**: Private to creator (typically)
   - **Action**: Save as draft

2. **Pending**
   - **Description**: Awaiting approval
   - **Submitted By**: Creator/owner
   - **Routes To**: Manager or designated approver
   - **Timeline**: SLA for approval (if configured)
   - **Notification**: Approver notified

3. **Approved**
   - **Description**: Time log accepted
   - **Approved By**: Manager/lead
   - **Effect**: Hours finalized for billing
   - **Reporting**: Included in all reports
   - **Edit Lock**: May be locked from editing

4. **Rejected**
   - **Description**: Time log returned for revision
   - **Reason**: Approver may provide feedback
   - **Action**: Creator must revise and resubmit
   - **Return To**: Reverted to "Draft"
   - **Notification**: Creator notified with reason

#### Approval Permissions
- **Creator**: Can submit own entries
- **Manager**: Can approve/reject team entries
- **Finance**: Can force approve/edit entries
- **Admin**: Can modify any entry

#### Approval Notifications
- Email to approver when pending
- Email to submitter on approval/rejection
- In-app notifications (real-time)
- Digest emails (daily/weekly summary)

---

## SECTION 8: PHASE AND TIME LOG INTEGRATION

### Relationships
- **Task-to-Phase**: Tasks belong to phases
- **Time Log-to-Task**: Time logs link to tasks
- **Time Log-to-Phase**: Indirectly through task association
- **Reporting**: Phase completion % includes all task hours

### Workflows

#### Typical Phase-to-Time Log Flow
1. Create Phase (start/end dates, owner)
2. Create Tasks within Phase
3. Team members log time against Tasks
4. Time logs submitted for approval
5. Approved hours contribute to Phase completion %
6. Phase marked complete when all tasks done

#### Reporting Hierarchy
- **Phase Reports**: Total hours, approved vs pending
- **Task Reports**: Hours logged, time per task
- **Time Log Reports**: Detail of all entries, approvals
- **User Reports**: Hours logged by team member

---

## SECTION 9: KEYBOARD SHORTCUTS

| Shortcut | Action |
|----------|--------|
| C + M | Add Phase |
| C + L | Add Time Log |
| Ctrl + Enter | Submit form |
| Z + H | Home |
| Z + R | Reports |
| Z + P | Projects |
| Z + A | Collaboration |
| Z + E | Expense Claims |
| Z + S | Setup |

---

## SECTION 10: COMMON TASKS AND WORKFLOWS

### Creating a Complete Phase
1. Click "Add Phase" button
2. Select Project from dropdown
3. Enter Phase Name
4. Set Owner (optional)
5. Set Start Date and End Date
6. Select Flag level (Internal/External)
7. Add Tags for organization
8. Click "Add" to save
9. Phase now appears in list

### Logging Time to a Task
1. Navigate to Time Logs
2. Click "Add Time Log"
3. Enter Log Title
4. Select Task from dropdown
5. Set Date and Time Period
6. Set Billing Type (Billable/Non-billable)
7. Add Notes (optional)
8. Click "Save"
9. Entry submitted for approval

### Approving Time Logs
1. Time logs route to manager inbox
2. Notification received (email/in-app)
3. Open time log detail
4. Review hours, task, billing type
5. Click "Approve" or "Reject"
6. If rejected, provide feedback
7. Notification sent to submitter

### Bulk Actions
- Select multiple entries (checkbox)
- Bulk approve/reject (if manager)
- Bulk change billing type
- Bulk export to CSV/PDF
- Bulk delete (if editable)

---

## APPENDIX: FIELD REFERENCE

### Phase Fields Summary
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Project | Dropdown | Yes | Cannot change after creation |
| Phase Name | Text | Yes | Unique within project |
| Owner | Dropdown | No | Defaults to Unassigned |
| Start Date | Date | Yes | Format: DD-MM-YYYY |
| End Date | Date | Yes | Must be >= Start Date |
| Flag | Dropdown | No | Defaults to Internal |
| Tags | Multi-select | No | Custom tags supported |
| Status | Read-only | N/A | Auto-calculated from tasks |
| % Complete | Read-only | N/A | Based on task completion |

### Time Log Fields Summary
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Log Title | Text | Yes | Brief description of work |
| Task | Dropdown | No | Links to specific task |
| Date | Date | Yes | Work performed date |
| Start Time | Time | Yes | HH:MM format |
| End Time | Time | Yes | Must be after start |
| Hours | Number | Yes | Auto-calculated or manual |
| Billing Type | Dropdown | Yes | Billable/Non-billable/Optional |
| Notes | Text Area | No | Additional context |
| Approval Status | Status | Auto | Pending/Approved/Rejected |

---

## Notes

- All screenshots and examples based on Zoho Projects interface as of April 2026
- Date formats follow DD-MM-YYYY convention (configurable by organization)
- Time formats configurable as 12-hour or 24-hour
- Features and options may vary based on organization settings and user permissions
- This documentation is comprehensive but not exhaustive; features continue to evolve

---

# PART 5: DASHBOARD, REPORTS & COLLABORATION

# Zoho Projects - Dashboard, Reports, Collaboration & Settings Documentation

## Section 1: Project Dashboard

### Location
- URL: `#zp/projects/{projectId}/dashboard`
- Accessible via main project navigation tabs

### Dashboard Header Elements
- **Project Dashboard Selector**: Dropdown to switch between "My Dashboards", "Shared Dashboards", and "System Dashboards"
- **Create Custom Dashboard**: Button to create new custom dashboard views
- **Search Widget**: Text input to search for specific widgets on dashboard
- **Dashboard Actions**:
  - Rename dashboard
  - Show Details (expand/collapse dashboard info)
  - Refresh (reload all widgets)

### Add Widget Button
Located in top-right, opens a panel with three widget type options:

#### 1. Chart Widget
- **Description**: Create chart widget to show data from your boards visually
- **Purpose**: Display visual representations of project data in various chart formats
- **Data Sources**: Can pull from any project boards

#### 2. Numbers (KPI) Widget
- **Description**: Get a quick view of your KPIs
- **Purpose**: Display key performance indicators and metrics
- **Use Case**: High-level project metrics

#### 3. Embedded Widget
- **Description**: Embed URL to dashboard (PDFs, TypeForm, Google maps, etc.)
- **Purpose**: Integrate external content directly into dashboard
- **Supported Content Types**: PDFs, TypeForms, Google Maps, and other embeddable URLs

### Pre-configured Dashboard Widgets

#### Task Status Widget
- **Chart Type**: Pie/Donut chart showing task distribution
- **Metrics Displayed**:
  - Open tasks count
  - Task breakdown by status
  - Color-coded visualization (e.g., green for open)
- **Actions Available**:
  - Filters button to apply custom filters
  - Expand widget to full view
  - More Actions menu (options vary)

#### Overdue Work Items Widget
- **Display**: Shows overdue tasks and issues
- **Message Format**: "Good job! No overdue work item(s) for now." (when empty)
- **Expandable**: Can expand to see details
- **More Actions Available**

#### Team Status Widget
- **Table Structure**:
  - User column with avatars
  - Tasks section (Overdue | Today's | All Open)
  - Issues section (Overdue | Today's | All Open)
- **Data Shown**: Per-user metrics including counts for each category
- **Color Coding**: Red for overdue, other colors for status indication
- **Expand Action**: Available

#### Issues Status Widget
- **Purpose**: Display current issue statuses
- **Filter Option**: Can apply filters
- **Expand Action**: Available
- **Display**: Shows filtered results or "No results found" message

#### Project Tags Cloud Widget
- **Purpose**: Visual representation of project tags
- **Display**: Cloud or tag layout
- **Filter Capability**: Yes
- **Expand Action**: Available

#### Weekly Digest Widget
- **Purpose**: Summary of weekly project activity
- **Display Format**: Digestible weekly summary
- **Expand Action**: Available

#### Top 5 Go-getters Widget
- **Purpose**: Recognition of top-performing team members
- **Metric**: Based on task/issue completion
- **Display**: Top 5 list format
- **Expand Action**: Available

#### Top 5 Issues Fixers Widget
- **Purpose**: Recognize top issue resolvers
- **Display**: Top 5 list
- **Expand Action**: Available

#### Phase Status Widget
- **Purpose**: Show milestone/phase progress
- **Filter Option**: Available
- **Display**: Phase-by-phase breakdown
- **Expand Action**: Available

#### Time Logs Summary Widget
- **Purpose**: Aggregate time tracking data
- **Filter Option**: Available
- **Display**: Summary of logged hours
- **Expand Action**: Available

#### Upcoming Events Widget
- **Purpose**: Show scheduled project events
- **Display Format**: Event list or calendar view
- **Expand Action**: Available

#### Upcoming Work Items Widget
- **Purpose**: Display tasks/issues due soon
- **Display**: Items approaching deadline
- **Expand Action**: Available

#### Today's Work Items Widget
- **Purpose**: Show items due today
- **Display**: Same-day deliverables
- **Expand Action**: Available

#### Task Progression Chart Widget
- **Purpose**: Track task movement through workflow
- **Chart Type**: Progress/flow visualization
- **Filter Option**: Available
- **Display**: Shows task state transitions
- **Expand Action**: Available

#### Planned Vs Actual Widget
- **Purpose**: Compare planned effort vs actual effort
- **Chart Type**: Comparative visualization
- **Display**: Side-by-side comparison
- **Expand Action**: Available

#### Tasks for My Team Members Widget
- **Purpose**: View tasks assigned to team
- **Filter Option**: Available
- **Display**: Team task list
- **Expand Action**: Available

#### Issues for My Team Members Widget
- **Purpose**: Show team issues
- **Filter Option**: Available
- **Display**: Team issue list
- **Expand Action**: Available

### Widget Common Features
- **Expand Icon**: Button to view widget in full screen
- **More Actions Menu**: Three-dot menu with additional options
- **Filter Capability**: Many widgets have filter buttons
- **Collapse/Minimize**: Can collapse widgets to save space

---

## Section 2: Reports

### Location
- URL: `#zp/projects/{projectId}/reports`
- Accessible via Reports tab in project navigation

### Report Types Dropdown Menu

#### Available Report Types:
1. **Workload Report** (Default)
   - **Purpose**: Visualize team workload distribution
   - **Format**: Calendar-based heatmap grid
   - **Timeframe**: Can select custom date ranges
   - **Filters**:
     - Status filter (All Open, etc.)
     - Assignee filter (by team member)
   - **Display**: Grid showing dates and workload intensity

2. **Planned Vs Actual**
   - **Purpose**: Compare planned timeline vs actual progress
   - **Metrics**: Planned dates vs completion dates
   - **Use Case**: Track schedule variance

3. **Custom Reports**
   - **Purpose**: User-created custom report definitions
   - **Functionality**: Build reports based on specific criteria

### Report Interface Elements

#### Date Range Selector
- **Format**: "MM-DD-YYYY to MM-DD-YYYY"
- **Navigation**: Left/right arrows to move through date ranges
- **Calendar Icon**: Click to open date picker
- **Display**: Currently showing dates in format (e.g., "04-01-2026 to 04-30-2026")

#### Filter Controls
- **Status Filter**:
  - Dropdown to filter by task/issue status
  - Options: All Open, Open, etc.
  - X button to remove individual filters
- **Clear Filter Button**: Reset all active filters
- **Search Box**: Text input to search within report data
  - Placeholder: "Search..."

#### Report Actions
- **View Options**: Heatmap, List, or other view modes
- **Export**: Download report data
- **More Actions**: Additional report operations

#### Report Display Area
- **Grid/Table Format**: Shows data organized in rows and columns
- **Left Panel**: User list with avatar and name
- **Main Area**: Date-based grid with color-coded cells indicating workload
- **Column Headers**: Dates (S, M, T, W, T, F, S for day abbreviations)
- **Navigation**: Scroll horizontally to view entire month

#### Secondary Filters (Example from Workload Report)
- **Task Owner Filter**:
  - Dropdown to select specific task owner
  - Shows current selection
  - Allows filtering by individual contributor

---

## Section 3: Collaboration - Feed

### Location
- URL: `#zp/collaboration/feed`
- Accessible via Collaboration > Feed tab

### Feed Interface Components

#### Main Feed Area
- **Text Input Box**: "Share a quick thought and start a discussion."
- **User Avatar**: Shows logged-in user's profile picture
- **Purpose**: Create new feed posts

#### Feed Display Sections
- **Tabs**:
  - Feed (default)
  - Status
  - Activity Stream

#### Feed Content Types

##### 1. Issue Added Activity
- **Format**: "Ankur Jain added {issue-type} in {project-name}"
- **Example**: "Ankur Jain added Issues in TaskFlow - Website Redesign"
- **Issue Display**:
  - Issue ID badge (e.g., "T-1-1")
  - Issue title as link
- **Action Links**:
  - Comment link
  - Show Description toggle
- **Timestamp**: "Today at 3:12 AM"

##### 2. Task Added Activity
- **Format**: "Ankur Jain has added a {task-type} in {project-name}"
- **Example**: "Ankur Jain has added a Task in TaskFlow - Website Redesign"
- **Task Display**:
  - Task ID badge (e.g., "T1-1-1")
  - Task title as link
- **Action Links**:
  - Comment
  - Show Description
- **Timestamp**: "Today at 3:06 AM"

##### 3. Task List Added Activity
- **Format**: "Ankur Jain has added a Task List in {project-name}"
- **Display**: Task list name (e.g., "General")
- **Action Links**:
  - Comment
  - Timestamp

##### 4. Project Creation Activity
- **Format**: "{User} created {project-name} project"
- **Example**: "Ankur Jain created TaskFlow - Website Redesign project"
- **Action Links**: Comment
- **Timestamp**: "Today at 3:02 AM"

##### 5. Welcome Message Activity
- **Format**: System message with project setup information
- **Content**: "Welcome to Zoho Projects" message with instructions

#### Feed Activity Actions
- **More Actions Menu**: Three-dot menu (•••) for each feed item
- **Comment Link**: Click to add comments
- **Show Description**: Toggle to view/hide full description
- **User Avatar**: Click to view user profile

#### Feed Filtering
- **All Feeds Dropdown**: Filter feed by type or source
- **Activity Stream Tab**: Separate view of all project activities

---

## Section 4: Collaboration - Calendar

### Location
- URL: `#zp/collaboration/calendar`
- Accessible via Collaboration > Calendar tab

### Calendar Interface

#### View Controls
- **View Type Selector**: Month dropdown
- **Navigation**: Left and right arrows to move between months
- **Date Display**: Shows current month and year (e.g., "April 2026")
- **Date Picker Icon**: Click to jump to specific month/year

#### Calendar Grid
- **Layout**: Standard month view in calendar grid format
- **Column Headers**: SUN, MON, TUE, WED, THU, FRI, SAT
- **Week Labels**: Right side shows week numbers (WEEK 14, 15, 16, 17, 18)
- **Date Cells**: Each day shows:
  - Date number
  - Previous/next month dates (grayed out)
  - Current date highlighting (e.g., "10" highlighted in blue)

#### Calendar Filters
- **Assignee Filter**: Dropdown to filter by team member
  - Selected user shows in header
  - Default: "Ankur Jain"
  - Allows multiple selections
- **Status Filter**: Dropdown to filter by status
  - Options: All Open, etc.
  - Shows current selection
- **Clear Filter Button**: Reset all filters

#### Calendar Actions
- **Add Activity Button**: Create new event/activity
- **More Actions Menu**: Additional calendar operations

#### Calendar Cells
- **Date Display**: Plain date numbers for empty days
- **Event Cells**: May contain event information (implementation dependent)
- **Cell Interaction**: Click to create/view activities

---

## Section 5: Collaboration - Chat

### Location
- URL: `#zp/collaboration/chat`
- Accessible via Collaboration > Chat tab

### Chat Interface

#### Main Display Area
- **Empty State Message**: "Nothing's being discussed right now"
- **Descriptive Text**: "Chat offers topic-centric conversations for your team that allow you to quickly get to the heart of any issues."
- **Action Button**: "New Conversation" button

#### Chat Functionality (when no conversations)
- **Purpose**: Topic-specific team discussions
- **Usage**: Quick resolution of issues through focused conversations
- **Initiation**: Click "New Conversation" to start new chat thread

#### Expected Chat Features (when implemented)
- **Conversation List**: Left sidebar showing active chats
- **Chat Window**: Main area for message display
- **Message Input**: Bottom area for typing messages
- **User List**: Team members in current conversation
- **@Mentions**: Tag specific users in messages
- **File Sharing**: Ability to share files in chat
- **Timestamps**: Show when messages were sent

---

## Section 6: User Profile Menu

### Location
- Click user avatar in top-right corner
- Displays in a right-side panel

### User Profile Information Section

#### User Details Display
- **Avatar**: Large circular user profile picture
- **Name**: Full name (e.g., "Ankur Jain")
- **Email**: User email address (e.g., "ai.paraslace@gmail.com")
- **Zoho User ID**: Unique identifier (e.g., "60068173163")
- **Organization ID**: Organization identifier (e.g., "60068377236")

#### Account Management
- **My Accounts**: Section header
- **Subscription Status**: "Your portal is currently in Ultimate Trial plan"
- **Subscription Details Button**: Click to view/manage subscription

### Help & Resources Section

#### Help Links
- **Help Videos**: Access video tutorials
- **Help Resources**: Documentation and guides
- **Contact Support**: Customer support contact
- **YouTube Channel**: Zoho Projects YouTube channel

#### Additional Resources
- **What's New**: Latest feature announcements
- **Webinar**: Training webinars
- **User Community**: Community forum access
- **Accessibility**: Accessibility options
- **Self Learning Course**: Training materials

### Themes Section

#### Color Themes
- **Label**: "Themes" section header
- **Color Options**: Multiple color theme swatches:
  - Orange
  - Light Blue
  - Teal/Cyan
  - Red
  - Green
  - Blue (currently selected, indicated by checkmark)

#### Panel Themes
- **Light Theme**: Standard bright interface
- **Dark Theme Option**: Dark mode available
- **Current Selection**: Indicated by checkmark

### Appearance Modes

#### Mode Options
- **Day**: Light theme (yellow sun icon)
- **Night**: Dark theme (moon icon)
- **Auto**: Automatic based on system settings (light bulb icon)
- **Enable Dim Mode**: Checkbox for additional brightness reduction

### Mobile & Browser Extensions

#### Get on Your Device
- **Section Header**: "Get on your device"

#### Mobile Apps
- **iOS App**: Apple App Store link
- **Android App**: Google Play Store link

#### Browser Extensions
- **Gmail**: Gmail integration extension
- **Chrome**: Chrome Web Store extension
- **Other Browsers**: Additional browser support options

### Sign Out
- **Sign Out Button**: Located at top of profile panel
- **Location**: Top-right corner for quick access

---

## Section 7: Header Icons & Controls

### Location
All icons located in top-right header area of application

### Icon Controls (Left to Right)

#### 1. Add Button
- **Icon**: Plus symbol (+)
- **Function**: Create new items (tasks, issues, etc.)
- **Dropdown**: Shows available creation options

#### 2. Search Button
- **Icon**: Magnifying glass
- **Function**: Global search across projects
- **Behavior**: Opens search interface

#### 3. Notifications Button
- **Icon**: Bell symbol
- **Function**: View notification center
- **Indicator**: Badge showing unread notification count
- **Contents**: Recent notifications, activity alerts

#### 4. Timer/Stopwatch Button
- **Icon**: Timer icon
- **Function**: Quick time tracking
- **Purpose**: Log time spent on current task

#### 5. Marketplace Button
- **Function**: Access Zoho marketplace
- **Purpose**: Browse and install extensions

#### 6. Setup/Settings Button
- **Icon**: Gear/cog symbol
- **Keyboard Shortcut**: Z + S
- **Function**: Access application settings
- **Menu Items**:
  - General settings
  - Integration settings
  - Customization options

#### 7. User Profile Button
- **Display**: User initials (e.g., "A" for Ankur)
- **Color**: Circular avatar with color background
- **Function**: Opens user profile menu (documented in Section 6)

#### 8. Applications Menu Button
- **Icon**: Grid of 9 dots
- **Function**: Switch between Zoho applications
- **Contents**: Quick access to other Zoho apps (Mail, Cliq, etc.)

---

## Section 8: Project Settings

### Location
- **URL**: `#allprojects/439389000000065476/proj-detail/{projectId}`
- **Access Method**: Click project name > Three-dot menu > "Edit Project"
- **Display Format**: Right-side panel that slides in

### Project Settings Panel

#### Header Section
- **Project Label**: "Project" indicator
- **Project Name Display**: Clickable link showing project name
- **Translate Option**: Button to translate project details
- **Other Actions Menu**: Three-dot menu for panel actions
- **Full Screen View**: Option to expand panel to full screen
- **Close Button**: X to close settings panel
- **Status Badge**: Shows current project status (e.g., "Active" in green)
- **Project ID**: AI-1 identifier

### Description Section

#### Description Field
- **Label**: "Description"
- **Expandable**: Checkbox to expand/collapse section
- **Status**: "NO DESCRIPTION AVAILABLE" (when empty)
- **Input Area**: Text editing space for project description
- **Submit**: "Ctrl + Enter to Submit" hint
- **Cancel Button**: Discard changes

### Project Information Section

#### Collapsible Section
- **Label**: "Project Information"
- **Expandable**: Checkbox to expand/collapse

#### Owner Field
- **Label**: "Owner" (required field indicated by *)
- **Display**: Avatar and user name (e.g., "Ankur Jain")
- **Type**: User selector dropdown
- **Editable**: Yes

#### Status Field
- **Label**: "Status" (required field indicated by *)
- **Options**: Dropdown selector
  - Active (default, shown with green dot)
  - Other status options available
- **Editable**: Yes

#### Start Date Field
- **Label**: "Start Date"
- **Format**: MM-DD-YYYY
- **Current Value**: "04-02-2026"
- **Type**: Date picker input
- **Calendar Icon**: Click to open date picker

#### End Date Field
- **Label**: "End Date"
- **Format**: MM-DD-YYYY
- **Type**: Optional date field
- **Calendar Icon**: Available for date selection
- **Status**: Can be empty

#### Tags Field
- **Label**: "Tags"
- **Type**: Multi-select input
- **Purpose**: Categorize project
- **Display**: Tag chips/badges

#### Task & Issues Prefix Field
- **Label**: "Task & Issues Prefix" (required field indicated by *)
- **Purpose**: Prefix for auto-generated task/issue IDs
- **Current Value**: "T-1"
- **Format**: Text input
- **Example Usage**: Tasks will be numbered T-1-1, T-1-2, etc.

#### Project Group Field
- **Label**: "Project Group" (required field indicated by *)
- **Type**: Dropdown selector
- **Current Value**: "Ungrouped Projects"
- **Purpose**: Organize projects into groups
- **Dropdown**: Expand to see available groups

#### Completion Time Field
- **Label**: "Completion Time"
- **Type**: Time input field
- **Purpose**: Expected total project duration
- **Unit**: Time measurement (hours, days, weeks, etc.)

### Comments Section

#### Tab Navigation
- **Comments Tab**: Active tab (default view)
- **Status Timeline Tab**: View project status changes
- **Activity Stream Tab**: View all project activities
- **Tab Content**: Changes based on selected tab

#### Comments Tab
- **User Avatar**: Shows commenter's profile picture
- **Text Editor**: Rich text editor toolbar including:
  - Bold (B)
  - Italic (I)
  - Underline (U)
  - Strikethrough (S)
  - Font selector (Puvi)
  - Font Size (13)
  - Font Color button
  - Background Color button
  - Alignment options
  - Bullet list options
  - Indent controls
  - Text direction (LTR)
  - Line spacing
  - More Options button
  - Content generation (Zia AI)
- **Text Area**: Message input field
- **Attachments**: File attachment section
  - "Attach Files" button to upload
- **Submit Button**: "Ctrl + Enter to Submit"
- **Cancel Button**: Discard comment
- **Email Option**: "To add Project Comment via email" link with email address

### Right-Side Navigation Panel

#### Settings Navigation
- **Back Button**: Return to previous view
- **Settings Menu Items**:
  - **Project Information**: Main settings (current view)
  - **Email Alias**: Configure email for project
  - **Zoho Cliq**: Chat integration settings

#### Panel Actions
- **Collapse**: Minimize settings panel
- **Show Extensions**: View integrated extensions/add-ons

### Additional Features

#### Project Actions (from context menu)
- **Edit Project**: Open this settings panel
- **View Details**: See project overview
- **Access Project**: Open project workspace
- **Color**: Change project color/theme
- **Email Alias**: Configure project email
- **Move to Archive**: Archive the project
- **Trash**: Delete project
- **Create Template**: Save as project template

---

## Navigation & Access Patterns

### Quick Navigation Shortcuts
- **Z + H**: Home
- **Z + R**: Reports
- **Z + P**: Projects
- **Z + A**: Collaboration
- **Z + E**: Expense Claims
- **Z + S**: Setup
- **Ctrl + Enter**: Submit forms/comments
- **Ctrl + Space**: Smart Chat

### Sidebar Navigation
- **Home**: Dashboard and overview
- **Reports**: Global and project reports
- **Projects**: Project management
- **Collaboration**: Feed, Calendar, Chat
- **My Approvals**: Pending approvals
- **Overview** (expandable):
  - Tasks
  - Issues
  - Phases
  - Time Logs
  - Timesheets

### Tab-Based Navigation
- Each project has tabs for:
  - Dashboard
  - Tasks
  - Users
  - Reports
  - Documents
  - Phases
  - Time Logs
  - Issues
  - Timesheet
  - More Tabs (searchable)

---

## Common UI Patterns

### Filter Pattern
- **Filter Button**: Opens filter criteria
- **Status/Category Filters**: Dropdown selectors
- **Clear Filter Button**: Reset all filters
- **Search within filtered results**: Text input box

### Widget Pattern
- **Widget Header**: Shows widget name and expansion state
- **Widget Actions**:
  - Filter button (if applicable)
  - Expand icon
  - More Actions menu (three dots)
- **Widget Content**: Data display area
- **Empty State**: "No results found" message

### Date Selection Pattern
- **Text Input**: Shows formatted date
- **Calendar Icon**: Opens date picker
- **Format**: MM-DD-YYYY

### User Selection Pattern
- **Avatar**: Shows user profile picture
- **Name**: Clickable user name
- **Dropdown**: Multiple user selection capability
- **Search**: Find users by name/email

### Collapsible Section Pattern
- **Checkbox**: Expand/collapse toggle
- **Section Label**: Describes content
- **Content Area**: Expandable information

---

## Keyboard Shortcuts & Tips

### Global Shortcuts
- **Z + Hotkey**: Navigation shortcuts (Z + H, Z + P, etc.)
- **Ctrl + Enter**: Submit forms, comments, chat messages
- **Ctrl + Space**: Open Smart Chat
- **Escape**: Close dialogs/panels

### Form Tips
- **Required Fields**: Indicated with red asterisk (*)
- **Field Hints**: Placeholder text and format examples
- **Submit Hints**: "Ctrl + Enter to Submit" messaging
- **Auto-save**: Some fields save automatically

---

## Notes for Users

1. **Dashboard Customization**: You can create multiple custom dashboards beyond the default project dashboard
2. **Widget Flexibility**: Widgets can be added, removed, and repositioned as needed
3. **Report Export**: Reports can be exported to various formats for external sharing
4. **Feed Mentions**: Use @username to mention team members in feed posts
5. **Chat Integration**: Chat is project-specific and topic-centric for focused discussions
6. **Email Integration**: Projects have email aliases for adding comments via email
7. **Time Tracking**: Timer in header provides quick time logging during work
8. **Mobile Access**: Mobile apps available for iOS and Android for on-the-go access
9. **Browser Extensions**: Gmail integration and other extensions available for enhanced workflow
10. **Settings Accessibility**: Most settings accessible via right-click context menu or settings panel


---

# PART 6: TIMESHEETS, USERS, DOCUMENTS & AUTOMATION

# Zoho Projects - Comprehensive Reference Guide
## TIMESHEETS, USERS, and DOCUMENTS Sections

---

## SECTION 1: TIMESHEETS PAGE

### Overview
The Timesheets section is accessible from the main navigation under **Timesheets** menu item. It displays a list view of all timesheets across the organization with filtering and management capabilities.

### URL
`https://projects.zoho.in/portal/aidotparaslacegmaildotcom#zp/timeloggroups/list?view=all`

### List View Columns

The Timesheets page displays the following columns:

| Column | Type | Description |
|--------|------|-------------|
| **Timesheet Name** | Text | Name/identifier of the timesheet |
| **Time Period** | Date Range | Start and end dates of the timesheet period (e.g., "04-05-2026 to 04-11-2026") |
| **Project Name** | Text | Associated project name |
| **Billing Type** | Enum | Type of billing (e.g., Billable, Non-billable) |
| **Total Hours** | Numeric | Total hours logged in the timesheet |
| **Approval Status** | Enum | Current approval status (Pending, Approved, Rejected) |
| **Added By** | User | User who created/added the timesheet |
| **Updated By** | User | User who last modified the timesheet |
| **Created Time** | DateTime | Timestamp when timesheet was created |
| **Modified Time** | DateTime | Timestamp when timesheet was last modified |

### Top Controls & Features

**Left Side:**
- **All Timesheets** - Dropdown to filter timesheet views
- **Filter Indicators** - Shows active filters (e.g., "Added By: Is Ankur Jain")
- **Clear Filter** - Button to remove all active filters
- **Help** - Documentation link

**Top Right:**
- **Approval Rules** - Button to configure approval workflow rules
- **Create Timesheet** - Blue button to create new timesheet
- **Data Last Fetched** - Timestamp indicator showing last data refresh (e.g., "Friday, 04-10-2026 at 03:11 AM")

### Filtering & Search
- **Active Filters** - Currently filtered by "Added By: Is Ankur Jain"
- **Filter Management** - Can add/remove multiple filter conditions
- **Clear Filter** - Removes all applied filters at once

### Empty State
- Message: "No Timesheets found in this view"
- Appears when no timesheets match current filter criteria

### Pagination
- Records per page configurable (typically 50 records per page default)
- Shows total count of records

---

## SECTION 2: CREATE TIMESHEET FORM

### Access
Click the **"Create Timesheet"** button on the Timesheets page to open the creation dialog.

### Dialog Title
"Create Timesheet"

### Form Fields

#### 1. **Time Period** (Required field marked with asterisk)
- **Type:** Date Range Input
- **Default Value:** "04-05-2026 to 04-11-2026" (Current week)
- **Format:** DD-MM-YYYY to DD-MM-YYYY
- **Description:** Defines the start and end dates for the timesheet period
- **Functionality:** Allows user to select or modify the date range

#### 2. **Log Users** (Required field marked with asterisk)
- **Type:** Dropdown/Multi-select Combobox
- **Default Value:** "Ankur Jain" (Current logged-in user)
- **Description:** Select which user(s) the timesheet will be created for
- **Features:**
  - Shows user avatar and name
  - Can add multiple users
  - Search capability within dropdown
  - List of available users displayed in listbox

#### 3. **Project** (Optional field)
- **Type:** Dropdown Combobox
- **Default Value:** Empty/Blank
- **Description:** Select the project associated with the timesheet
- **Features:**
  - Searchable dropdown
  - List of available projects
  - Can be left blank for general timesheets

#### 4. **Customer** (Optional field)
- **Type:** Dropdown with Clear Button
- **Label:** "Select"
- **Default Value:** Empty/Blank
- **Features:**
  - Clear button to reset selection
  - Searchable dropdown list

#### 5. **Billing Type** (Optional field)
- **Type:** Dropdown Combobox
- **Label:** "Select"
- **Default Value:** Empty/Blank
- **Description:** Specify billing classification (Billable, Non-billable, etc.)
- **Features:**
  - Searchable dropdown

### Form Buttons

| Button | Type | Color | Function |
|--------|------|-------|----------|
| **Create** | Submit Button | Blue | Saves the timesheet and creates it; Keyboard shortcut: Ctrl + Enter |
| **Cancel** | Close Button | Outlined | Closes the dialog without saving |

### Form Behavior
- **Required Fields:** Time Period, Log Users (marked with red asterisk)
- **Optional Fields:** Project, Customer, Billing Type
- **Auto-populated:** Time Period defaults to current week; Log Users defaults to current user
- **Validation:** Form validates required fields before allowing submission
- **Keyboard Shortcut:** Ctrl + Enter to create

### Dialog Features
- **Location:** Right-side slide-in panel/modal dialog
- **Width:** Approximately 400-500px
- **Overlay:** Semi-transparent dark background
- **Responsive:** Adjusts based on screen size

---

## SECTION 3: TIMESHEET APPROVAL WORKFLOW

### Approval Rules Management
- **Button Location:** Top right area of Timesheets page
- **Button Name:** "Approval Rules"
- **Function:** Opens interface to configure approval workflow rules

### Approval Status Values
The timesheet approval status field can have the following values:
- **Pending** - Awaiting approval
- **Approved** - Approved by authorized user
- **Rejected** - Rejected with possible comments
- **Draft** - Not yet submitted

### Approval Process
1. Timesheet is created and initially in "Pending" or "Draft" status
2. Designated approver(s) review the timesheet
3. Approver can Approve or Reject
4. Status updates accordingly
5. Notifications may be sent to user

### Approval Rules Configuration
Administrators can set up rules to:
- Define who can approve timesheets
- Set approval thresholds (e.g., by amount, department)
- Configure escalation paths
- Enable/disable auto-approval based on conditions

---

## SECTION 4: USERS PAGE

### Access
Click the **"Users"** tab in the project navigation bar (top horizontal menu).

### URL
`https://projects.zoho.in/portal/aidotparaslacegmaildotcom#zp/projects/439389000000068004/users/custom-view/1/list`

### Page Structure

**Left Sidebar:**
- **Users** - Main category showing total users
- **Client Users** - Separate category for client-type users
- **Teams** - For team management
- **Resources** - Resource management
- **Search** - Text search box with placeholder "Search users"
- **View Options** - Toggle between List and Grid views

### List View Columns

| Column | Type | Description |
|--------|------|-------------|
| **User Name** | Text | Name of the user with avatar |
| **Email ID** | Email | User's email address with copy-to-clipboard icon |
| **Role** | Enum | Project role (see Role Types below) |
| **Project Profile** | Enum | User's profile type in the project |
| **Portal Profile** | Enum | User's profile type in the portal |
| **Invitation Status** | Enum | Acceptance status of invite |
| **Add Column** | Action | Option to add custom columns |

### User Example
Current user listed: **Ankur Jain**
- **Email:** ai.paraslace@gmail.com
- **Role:** Administrator
- **Project Profile:** Portal Owner
- **Portal Profile:** Portal Owner
- **Invitation Status:** Accepted

### User Role Types

The system supports the following project roles:

| Role | Description | ID |
|------|-------------|-----|
| **Administrator** | Full system access and controls | 439389000000065003 |
| **Manager** | Team lead with approval authority | 439389000000065004 |
| **Employee** | Standard project team member | 439389000000065005 |
| **Contractor** | External contractor/vendor | 439389000000065006 |

### Portal Profile Types

| Profile | Description | ID |
|---------|-------------|-----|
| **Portal Owner** | Primary portal administrator | |
| **Employee** | Standard portal user | 439389000000065044 |
| **Manager** | Manager profile | 439389000000065043 |
| **Contractor** | Contractor/vendor profile | 439389000000065045 |

### Additional User Types

| Type | Description | ID |
|------|-------------|-----|
| **Read-only User** | View-only access | 439389000000065050 |
| **Lite User** | Limited access variant | 439389000000065051 |

### Pagination & Controls
- **Records Per Page:** Default 50, configurable dropdown
- **Page Navigation:** First, Previous, Next, Last buttons
- **Total Count:** "Total Count: 1" (or actual number)
- **View Toggle:** List (default) and Grid view options
- **Search:** Search users text box for filtering

### Filters Available
- **Recently Added** - Shows newly added users
- **All Users** - Complete user list
- **Search Term** - Dynamic search filtering

---

## SECTION 5: INVITE USERS DIALOG

### Access
Click **"Add Users"** button on the Users page

### Dialog Title
"Add Users"

### Dialog Tabs

#### Tab 1: **Portal Users** (Default)
Manages portal-level users

#### Tab 2: **Invite Users** (Main tab for invitations)
For inviting new users to the project

### Form Fields (Invite Users Tab)

#### 1. **Email ID** (Required)
- **Type:** Text Input field
- **Label:** "Email ID" (with red asterisk for required)
- **Placeholder:** Empty
- **Description:** Single or multiple email addresses to invite
- **Validation:** Must be valid email format

#### 2. **User Type Selection** (Required)
- **Type:** Radio Button Group
- **Options:**
  - **User** (Default selected)
    - Full access user with create/edit/delete permissions
  - **Lite user**
    - Limited feature access
  - **Read-only user** (with info icon)
    - Can view but cannot add, edit, or delete Task, Bug, or Milestone
    - Description: "Users can view but cannot add, edit or delete any Task, Bug or Milestone in the portal"

#### 3. **Invitation Template** (Optional)
- **Type:** Dropdown Combobox
- **Default Value:** "Default Invitation Template"
- **Label:** "Invitation Template"
- **Link:** "Add Invitation Template" (clickable link to create custom template)
- **Description:** Select email template for invitation message
- **Features:** Searchable dropdown with predefined templates

#### 4. **Role** (Required)
- **Type:** Dropdown Combobox with Search
- **Default Value:** "Employee"
- **Label:** "Role"
- **Available Options:**
  - Employee (Default) - ID: 439389000000065005
  - Administrator - ID: 439389000000065003
  - Manager - ID: 439389000000065004
  - Contractor - ID: 439389000000065006
- **Features:**
  - Searchable dropdown
  - Can select multiple roles (if system allows)

#### 5. **Profile** (Required/Optional)
- **Type:** Dropdown Combobox with Search
- **Default Value:** "Employee"
- **Label:** "Profile"
- **Available Options:**
  - Employee (Default) - ID: 439389000000065044
  - Manager - ID: 439389000000065043
  - Contractor - ID: 439389000000065045
- **Features:** Searchable dropdown with profile selection

#### 6. **Additional Profile Types** (System fields)
- **Read-only Profile** - ID: 439389000000065050
- **Lite User Profile** - ID: 439389000000065051

#### 7. **Business Hours** (Optional)
- **Type:** Dropdown Combobox
- **Default Value:** "Standard Business Hours"
- **Label:** "Business Hours"
- **Description:** Select business hours for the user
- **Features:** Searchable dropdown with predefined schedules

### Notification Section
- **Checkbox:** "Notify added users"
- **Description:** When checked, invited users receive email notification
- **Default State:** Unchecked

### Information Messages
- **Portal Users Message:** "All portal users are already part of this project. to the portal and associate them with this project."
- **User Limit:** "Only the first 50 users will be selected."

### Dialog Buttons

| Button | Type | Color | Function |
|--------|------|-------|----------|
| **Add** | Submit Button | Blue | Adds/invites the user(s); Keyboard shortcut: Ctrl + Enter |
| **Cancel** | Close Link | Text link | Closes dialog without saving |

### Additional Actions
- **View Profile Permissions** - Link in top right to view permission details

### User Addition Flow
1. Enter email address(es) in Email ID field
2. Select user type (User, Lite user, or Read-only)
3. Choose appropriate role and profile
4. Set business hours if needed
5. Optionally enable "Notify added users"
6. Click "Add" to invite
7. User receives invitation email and must accept to access project

---

## SECTION 6: DOCUMENTS PAGE

### Access
Click the **"Documents"** tab in the project navigation bar

### URL
`https://projects.zoho.in/portal/aidotparaslacegmaildotcom#documents/439389000000068004`

### Page Layout

**Left Sidebar:**
- **Project Attachments** - Main document section
- **Folders (1)** - Folder management area with count
  - Default folder: "AI-1-TaskFlow - Website Redesign-Attachments" (Default folder)
  - Add new folder icon
- **Team folders** - Section for team-managed folders
  - Message: "Create or associate team folders from WorkDrive and start managing documents."
  - Link: "Create or Associate Team Folder"

**Main Content Area:**
- **Breadcrumb Navigation:** Shows current folder path
- **Document Grid View** - Display area for uploaded documents
- **Empty State Message:** "No items available" when folder is empty

### Top Controls

**Right Side Toolbar:**
- **Record** - Dropdown button (type of record to display)
- **New** - Blue button to create new items
- **View Options:**
  - List view icon
  - Grid view icon
- **Sort/Filter Options** - Additional control buttons

### Document Management Features

#### 1. **Create Options** (From "Create" dropdown button)
- **Create Folder** - Creates new folder for organization
- **Create Document** - Creates new document within project
- **Other create options** - May include various document types

#### 2. **Upload Options** (From "Upload" dropdown button)

| Option | Shortcut | Description |
|--------|----------|-------------|
| **Upload Files** | Ctrl + Shift + F | Upload individual files to the folder |
| **Upload Folder** | Ctrl + Shift + U | Upload entire folder structure |
| **Import from Cloud** | - | Import files from cloud storage (Google Drive, OneDrive, etc.) |

#### 3. **Record Options** (From "Record" dropdown button)
- Different record type selections
- Document categorization options

#### 4. **Drag and Drop Functionality**
- Users can drag and drop files directly into the upload area
- Can copy and paste items within documents
- Drag files to rearrange or move to folders

### Folder Structure

#### Default Folder (Auto-created)
- **Name:** "AI-1-TaskFlow - Website Redesign-Attachments"
- **Type:** Default/System folder
- **Description:** Primary attachment storage for the project
- **Features:**
  - Automatically created for each project
  - Cannot be deleted (locked)

#### Custom Folders
- Users can create additional folders for organization
- Support nested folder structure
- Can set folder permissions

### Team Folders Integration
- **WorkDrive Integration** - Seamless connection to Zoho WorkDrive
- **Team Collaboration** - Multiple team members can access and edit
- **File Versioning** - Automatic version control
- **Sharing Controls** - Set access levels per folder

### Document Type Support

Supported formats typically include:
- **Documents:** .doc, .docx, .pdf, .txt, .odt
- **Spreadsheets:** .xls, .xlsx, .csv
- **Presentations:** .ppt, .pptx
- **Images:** .jpg, .jpeg, .png, .gif, .bmp
- **Archives:** .zip, .rar
- **Audio/Video:** .mp4, .avi, .mov, .mp3, .wav
- **Other:** Various other formats supported

### Upload Restrictions
- **File Size Limit:** Depends on plan (typically 25MB per file)
- **Total Storage:** Varies by subscription
- **Batch Upload:** Supported for multiple files

### Document Access Controls
- **View Permission** - Can be set per user/role
- **Edit Permission** - Restricted to authorized users
- **Download Permission** - Can be enabled/disabled
- **Share Option** - Share links with expiration dates
- **Version History** - Track all document changes

### Additional Features
- **Details Panel** - Right sidebar with metadata
- **Zia Integration** - AI-powered search and suggestions
- **Recent Files** - Quick access to recently accessed documents
- **Search** - Full-text search across documents
- **Metadata** - File properties, upload date, uploader info

---

## SECTION 7: UPLOAD/ADD DOCUMENT DIALOG

### Accessing Upload

**Method 1:** From Documents page
- Click **"Upload"** dropdown button
- Select upload option from menu

**Method 2:** Drag and Drop
- Drag files from computer directly into the document area
- Shows dotted border drop zone

**Method 3:** Keyboard Shortcut
- **Upload Files:** Ctrl + Shift + F
- **Upload Folder:** Ctrl + Shift + U

### Upload Menu Options

#### Option 1: **Upload Files** (Ctrl + Shift + F)
- **Type:** File Browser Dialog
- **Function:** Upload individual or multiple files
- **File Selection:** Multi-select capable
- **Supported Formats:** All document types
- **Limits:** Single file size limit, batch file size limit
- **Process:**
  1. Opens system file picker
  2. Select file(s) to upload
  3. Click "Open" to upload
  4. Progress indicator shows upload status
  5. Files appear in current folder upon completion

**Features:**
- Drag and drop support within picker
- File preview on hover
- Size indicator before upload
- Cancel option during upload

#### Option 2: **Upload Folder** (Ctrl + Shift + U)
- **Type:** Folder Browser Dialog
- **Function:** Upload entire folder structure with contents
- **Structure Preservation:** Maintains folder hierarchy
- **Contents:** All files within folder are uploaded
- **Process:**
  1. Opens system folder picker
  2. Select folder to upload
  3. Click "Open" to upload
  4. Progress shows upload status per file
  5. Folder structure appears in current location

**Features:**
- Recursive folder upload
- Batch upload processing
- Status tracking for each item
- Error handling for failed items

#### Option 3: **Import from Cloud**
- **Type:** Cloud Storage Integration
- **Connected Services:**
  - Google Drive
  - OneDrive
  - Dropbox
  - Other cloud services (if configured)
- **Process:**
  1. Click "Import from Cloud"
  2. Select cloud service
  3. Authorize access if first time
  4. Browse cloud files/folders
  5. Select items to import
  6. Files are downloaded and uploaded to project

**Features:**
- OAuth authentication for security
- Browse cloud folders
- Preview cloud files
- Batch cloud import
- Link synchronization option

### Upload Progress Indicators
- **Progress Bar** - Visual upload progress
- **File Count** - Shows X of Y files uploading
- **Speed Indicator** - Upload speed (KB/s, MB/s)
- **Time Remaining** - Estimated completion time
- **Cancel Button** - Stop upload in progress

### Post-Upload Actions
- **File Appears in Folder** - Automatically listed
- **Metadata Populated** - Upload date, uploader, size
- **Notifications** - Optional upload complete notification
- **Version Control** - File version tracked automatically
- **Sharing Options** - Can immediately configure sharing

### Error Handling
- **File Already Exists** - Option to replace or rename
- **Unsupported Format** - Warning message
- **File Size Exceeded** - Error preventing upload
- **Quota Exceeded** - Storage limit reached message
- **Permission Denied** - Insufficient access rights
- **Network Error** - Retry option

### Advanced Upload Features
- **Bulk Upload** - Multiple files/folders simultaneously
- **Resume Upload** - Resume interrupted uploads
- **File Naming** - Automatic or custom naming conventions
- **Metadata Assignment** - Set document properties during upload
- **Workflow Trigger** - Auto-trigger workflows on upload
- **Notification Settings** - Notify team members of uploads

---

## SECTION 8: AUTOMATION INTERFACE (Additional Section)

### Accessing Automation
- **Button Location:** Top right area of Timesheets page
- **Button Name:** "Automation"
- **Alternative:** May be accessible from project settings

### Automation Rule Types

#### Triggers (When conditions)
Automation rules can be triggered by:
1. **Timesheet Created** - When new timesheet is added
2. **Timesheet Updated** - When timesheet is modified
3. **Status Changed** - When timesheet status changes
4. **Approval Complete** - When approval workflow completes
5. **Assignment Change** - When user assignment changes
6. **Due Date Approaching** - When deadline nears
7. **Manual Trigger** - User-initiated automation

#### Conditions (If conditions)
Rules can evaluate:
- **Timesheet Amount** - Greater than/less than value
- **Status Match** - Specific approval status
- **User Match** - Assigned to specific user/role
- **Date Conditions** - Before/after specific date
- **Custom Fields** - Match custom field values
- **Time Period** - Specific date range

#### Actions (Then do)
Automation can perform:
1. **Send Email** - Notify users
2. **Update Status** - Change approval status automatically
3. **Create Record** - Generate related records
4. **Update Field** - Modify timesheet fields
5. **Trigger Workflow** - Initiate workflows
6. **Send Notification** - In-app notifications
7. **Create Task** - Create associated task
8. **Call Webhook** - External system integration
9. **Log Action** - Audit trail entry
10. **Assign Task** - Reassign to different user

### Automation Rule Configuration Fields
- **Rule Name** - Identifier for automation rule
- **Description** - Purpose and details
- **Trigger Type** - When rule fires
- **Trigger Conditions** - Optional additional conditions
- **Action Type** - What automation does
- **Action Parameters** - Configuration for action
- **Active/Inactive** - Enable/disable rule
- **Run Order** - Priority for multiple rules
- **Scope** - Which timesheets are affected

### Automation Examples

**Example 1: Auto-Approval for Small Amounts**
- Trigger: Timesheet Created
- Condition: Total Hours < 10
- Action: Auto-approve the timesheet

**Example 2: Manager Notification**
- Trigger: Timesheet Status = Pending
- Condition: Amount > $500
- Action: Send email to manager

**Example 3: Escalation**
- Trigger: Approval Pending > 3 days
- Condition: Status = Pending
- Action: Send escalation email to executive

### Advanced Features
- **Rule Templates** - Pre-built automation templates
- **Bulk Rule Management** - Manage multiple rules at once
- **Rule Versioning** - Track rule change history
- **Testing Mode** - Test rules before activation
- **Audit Log** - View automation execution history
- **Performance Metrics** - Track automation effectiveness

---

## SUMMARY TABLE: KEY RESOURCES

| Feature | Access Point | Primary Fields | Key Actions |
|---------|--------------|-----------------|------------|
| **Timesheets** | Sidebar → Timesheets | Time Period, Users, Project, Billing Type | Create, Approve, Filter |
| **Create Timesheet** | Create Timesheet button | Time Period (required), Log Users (required), Project, Customer, Billing Type | Submit, Cancel |
| **Users** | Project → Users tab | User Name, Email, Role, Profile, Status | Add Users, Edit, Delete, View Permissions |
| **Add Users** | Add Users button | Email (required), User Type, Role, Profile, Business Hours | Invite, Cancel |
| **Documents** | Project → Documents tab | Folders, Files, Metadata, Sharing | Upload, Create, Edit, Delete, Share |
| **Upload Document** | Upload button | Files/Folders to upload, Cloud sources | Upload Files, Upload Folder, Import Cloud |
| **Automation** | Automation button | Triggers, Conditions, Actions | Create Rule, Edit, Delete, Test |

---

## KEYBOARD SHORTCUTS

| Shortcut | Function |
|----------|----------|
| **Ctrl + Enter** | Submit form (Create Timesheet, Add Users) |
| **Z + H** | Go to Home |
| **Z + P** | Go to Projects |
| **Z + R** | Go to Reports |
| **Z + E** | Go to Expense Claims |
| **Z + S** | Open Setup |
| **Ctrl + Shift + F** | Upload Files |
| **Ctrl + Shift + U** | Upload Folder |
| **C + U** | Add Users (from Users page) |

---

## TIPS & BEST PRACTICES

### Timesheets
- Create timesheets at the beginning of each period
- Assign to correct user and project for accurate tracking
- Set appropriate billing type for invoicing accuracy
- Regularly check approval status
- Use filters to organize by project or user

### Users
- Assign appropriate roles based on responsibilities
- Set business hours matching user's actual schedule
- Use profiles to control feature access
- Notify users of invitations for faster acceptance
- Remove inactive users periodically

### Documents
- Organize files in folders by project/phase
- Use descriptive names for easy searching
- Set appropriate sharing permissions
- Regularly clean up outdated documents
- Leverage drag-and-drop for quick uploads
- Use cloud import for easier file transfer

### Automation
- Test rules before full deployment
- Start with simple rules and increase complexity
- Monitor automation execution logs
- Create rules for repetitive tasks
- Document rule purposes for maintenance

---

## TROUBLESHOOTING

### Common Issues

**Timesheet Not Saving**
- Check required fields are filled
- Verify user has necessary permissions
- Ensure project is still active

**User Invitation Not Received**
- Check email spelling
- Verify email is not already in system
- Check spam/junk folder
- Resend invitation if needed

**Document Upload Failed**
- Check file size doesn't exceed limit
- Verify file format is supported
- Ensure sufficient storage quota
- Check folder permissions
- Try different browser if persistent

**Automation Not Triggering**
- Verify rule is enabled/active
- Check conditions match actual data
- Review audit logs for errors
- Test rule with manual trigger
- Verify email addresses for notifications

---

## ADDITIONAL RESOURCES

- **Help Center** - In-app help icon with documentation
- **Support** - Support button in top right
- **Learning Center** - Video tutorials and guides
- **Page Tour** - Guided walkthrough of current page
- **Webinar** - Scheduled training sessions

---

*Document Version: 1.0*
*Last Updated: April 10, 2026*
*Scope: Zoho Projects - Timesheets, Users, Documents, and Automation sections*


---

# PART 7: IMPLEMENTATION GUIDE FOR TASKFLOW

## Database Schema (Based on Zoho Projects Analysis)

### Core Entities

```sql
-- Projects
CREATE TABLE projects (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'Active', -- Active, On Hold, Completed, Archived
    start_date DATE,
    end_date DATE,
    completion_pct DECIMAL(5,2) DEFAULT 0,
    business_hours_id UUID REFERENCES business_hours(id),
    is_strict BOOLEAN DEFAULT FALSE,
    project_group_id UUID REFERENCES project_groups(id),
    task_prefix VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phases/Milestones
CREATE TABLE phases (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    owner_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'Open', -- Open, Closed
    start_date DATE,
    end_date DATE,
    completion_pct DECIMAL(5,2) DEFAULT 0,
    flag VARCHAR(50), -- Internal, External, Critical
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task Lists (grouping for tasks)
CREATE TABLE task_lists (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    phase_id UUID REFERENCES phases(id),
    name VARCHAR(255) NOT NULL,
    position INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    task_list_id UUID REFERENCES task_lists(id),
    phase_id UUID REFERENCES phases(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'Open', -- Open, In Progress, Closed, On Hold, Cancelled
    priority VARCHAR(20) DEFAULT 'None', -- None, Low, Medium, High
    start_date DATE,
    due_date DATE,
    duration_hours DECIMAL(10,2),
    work_hours DECIMAL(10,2),
    completion_pct INT DEFAULT 0,
    is_billable BOOLEAN DEFAULT TRUE,
    parent_task_id UUID REFERENCES tasks(id), -- for subtasks
    position INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Issues
CREATE TABLE issues (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    reporter_id UUID NOT NULL REFERENCES users(id),
    assignee_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'Open', -- Open, In Progress, Closed, On Hold, Not a Bug, Reopened
    severity VARCHAR(50) DEFAULT 'None', -- None, Minor, Major, Critical, Show Stopper
    due_date DATE,
    classification VARCHAR(50), -- Bug, Feature Request, Improvement, Task
    reproducible VARCHAR(50), -- Always, Sometimes, Rarely, Unable, Not Applicable
    module VARCHAR(255),
    release_phase_id UUID REFERENCES phases(id),
    affected_phase_id UUID REFERENCES phases(id),
    flag VARCHAR(50), -- Internal, External
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Time Logs
CREATE TABLE time_logs (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    task_id UUID REFERENCES tasks(id),
    issue_id UUID REFERENCES issues(id),
    user_id UUID NOT NULL REFERENCES users(id),
    timesheet_id UUID REFERENCES timesheets(id),
    title VARCHAR(255),
    log_date DATE NOT NULL,
    hours DECIMAL(10,2) NOT NULL,
    billing_type VARCHAR(50) DEFAULT 'Billable', -- Billable, Non-billable
    approval_status VARCHAR(50) DEFAULT 'Pending', -- Draft, Pending, Approved, Rejected
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timesheets
CREATE TABLE timesheets (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_hours DECIMAL(10,2) DEFAULT 0,
    billing_type VARCHAR(50) DEFAULT 'Billable',
    approval_status VARCHAR(50) DEFAULT 'Pending', -- Pending, Approved, Rejected
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments/Activity
CREATE TABLE comments (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- task, issue, phase, project, timelog
    entity_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES comments(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tags
CREATE TABLE tags (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    UNIQUE(tenant_id, name)
);

-- Entity Tags (polymorphic)
CREATE TABLE entity_tags (
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    tag_id UUID NOT NULL REFERENCES tags(id),
    PRIMARY KEY (entity_type, entity_id, tag_id)
);

-- Documents
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    folder_id UUID REFERENCES document_folders(id),
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automation Rules
CREATE TABLE automation_rules (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(100) NOT NULL, -- on_create, on_update, on_status_change, on_due_date
    trigger_entity VARCHAR(50) NOT NULL, -- task, issue, phase, timelog
    conditions JSONB, -- flexible conditions
    actions JSONB NOT NULL, -- actions to perform
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Endpoints to Implement

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | /api/projects | List/Create projects |
| GET/PUT/DELETE | /api/projects/:id | Get/Update/Delete project |
| GET/POST | /api/projects/:id/tasks | List/Create tasks |
| GET/PUT/DELETE | /api/tasks/:id | Get/Update/Delete task |
| GET/POST | /api/projects/:id/issues | List/Create issues |
| GET/PUT/DELETE | /api/issues/:id | Get/Update/Delete issue |
| GET/POST | /api/projects/:id/phases | List/Create phases |
| GET/PUT/DELETE | /api/phases/:id | Get/Update/Delete phase |
| GET/POST | /api/projects/:id/timelogs | List/Create time logs |
| GET/PUT/DELETE | /api/timelogs/:id | Get/Update/Delete time log |
| GET/POST | /api/projects/:id/timesheets | List/Create timesheets |
| PUT | /api/timesheets/:id/approve | Approve timesheet |
| PUT | /api/timesheets/:id/reject | Reject timesheet |
| GET/POST | /api/projects/:id/documents | List/Upload documents |
| GET/POST | /api/projects/:id/comments | List/Create comments |
| GET | /api/reports/workload | Workload report |
| GET | /api/dashboard | Dashboard widgets data |
| GET/POST | /api/projects/:id/automation | List/Create automation rules |
| GET/POST | /api/projects/:id/users | List/Add project users |
| POST | /api/users/invite | Invite users |
| GET | /api/collaboration/feed | Activity feed |

## Frontend Routes to Implement

| Route | Component | Purpose |
|-------|-----------|---------|
| /dashboard | DashboardComponent | Home with summary cards |
| /projects | ProjectListComponent | Project listing with tabs |
| /projects/new | ProjectCreateComponent | New project form |
| /projects/:id | ProjectDetailComponent | Project detail with tabs |
| /projects/:id/tasks | TaskListComponent | Task list with filters |
| /projects/:id/issues | IssueListComponent | Issue list with severity |
| /projects/:id/phases | PhaseListComponent | Phase/milestone list |
| /projects/:id/timelogs | TimeLogListComponent | Time log entries |
| /projects/:id/timesheets | TimesheetListComponent | Timesheet management |
| /projects/:id/documents | DocumentListComponent | Document management |
| /projects/:id/users | UserListComponent | Project users |
| /projects/:id/reports | ReportComponent | Project reports |
| /projects/:id/settings | SettingsComponent | Project settings |
| /collaboration | CollaborationComponent | Feed, Calendar, Chat |
| /approvals | ApprovalsComponent | Timesheet approvals |
| /reports | GlobalReportsComponent | Cross-project reports |

---

*This documentation was generated by analyzing Zoho Projects using 5 parallel AI agents, capturing 249+ interactions across all modules. Use this as the complete blueprint for building TaskFlow.*

