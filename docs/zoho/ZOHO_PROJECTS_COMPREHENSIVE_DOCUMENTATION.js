const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel,
        AlignmentType, WidthType, BorderStyle, ShadingType, PageBreak, LevelFormat } = require('docx');
const fs = require('fs');

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "1F4E78" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "2E75B6" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "2E75B6" },
        paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
        ]
      }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    children: [
      // Title
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun("Zoho Projects - Complete System Documentation")]
      }),

      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 },
        children: [new TextRun({ text: "A Comprehensive Guide to Features, Workflows, and Interface Details", italic: true })]
      }),

      // Section: Overview
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("1. System Overview")]
      }),

      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("Zoho Projects is a multi-tenant, cloud-based project management SaaS platform that enables teams to plan, track, and collaborate on projects efficiently. The system provides comprehensive tools for task management, issue tracking, time logging, resource planning, and project analytics.")]
      }),

      // Core Features
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Core Features")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Project Planning &#x2013; Create and organize projects with phases/milestones")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Task Management &#x2013; Create, assign, and track tasks with status, priority, and deadlines")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Issue Tracking &#x2013; Log and manage project issues with severity and resolution tracking")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Time Logging &#x2013; Track work hours and create timesheets for billing and reporting")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Team Collaboration &#x2013; Communicate via feeds, comments, and real-time updates")]
      }),

      // Section: Navigation Structure
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("2. Navigation Structure & Interface")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Left Sidebar Menu")]
      }),

      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("The primary navigation menu is located on the left side of the interface. It provides quick access to all major sections and modules.")]
      }),

      // Table: Menu Items
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3120, 6240],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders, shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                width: { size: 3120, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: "Menu Item", bold: true })] })]
              }),
              new TableCell({
                borders, shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                width: { size: 6240, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: "Description & Purpose", bold: true })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Home")] })] }),
              new TableCell({ borders, width: { size: 6240, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Dashboard showing global overview with task/issue/phase summary cards and personal task/issue lists")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Reports")] })] }),
              new TableCell({ borders, width: { size: 6240, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Analytics and reporting tools including Workload Reports, resource allocation, and team performance metrics")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Projects")] })] }),
              new TableCell({ borders, width: { size: 6240, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Centralized project listing with filtering by status (Active, Templates, Groups, Public, Archived)")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Collaboration")] })] }),
              new TableCell({ borders, width: { size: 6240, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Team communication tools: Feed, Calendar, and Chat for discussions and updates")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("My Approvals")] })] }),
              new TableCell({ borders, width: { size: 6240, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Workflow approvals section for reviewing and approving timesheets and other items")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Tasks")] })] }),
              new TableCell({ borders, width: { size: 6240, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("All project tasks with filtering, grouping, and custom views. Can group by Task List or other criteria")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Issues")] })] }),
              new TableCell({ borders, width: { size: 6240, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Issue tracking with severity levels, status, and resolution management")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Phases")] })] }),
              new TableCell({ borders, width: { size: 6240, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Project milestones/phases with start/end dates and associated tasks/issues")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Time Logs")] })] }),
              new TableCell({ borders, width: { size: 6240, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Daily work time entries grouped by date, linked to tasks/projects for billing")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 3120, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Timesheets")] })] }),
              new TableCell({ borders, width: { size: 6240, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Timesheet management with approval workflows and billing type tracking")] })] })
            ]
          })
        ]
      }),

      new Paragraph({ spacing: { after: 240 }, children: [new TextRun("")] }),

      // Section: Home Dashboard
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("3. Home Dashboard")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Dashboard Overview")]
      }),

      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("The Home dashboard provides a real-time overview of all project activities. It displays key metrics and personal task assignments in a customizable widget-based layout.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Global Dashboard Dropdown")]
      }),

      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun("Located at the top of the dashboard, this dropdown allows switching between different dashboard views or selecting a specific global dashboard configuration.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Summary Cards")]
      }),

      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("Six summary cards display real-time counts of work items in different states:")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Open Tasks &#x2013; Count of all tasks with &#x201C;Open&#x201D; status")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Closed Tasks &#x2013; Count of completed/closed tasks")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Open Issues &#x2013; Count of active issues awaiting resolution")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Closed Issues &#x2013; Count of resolved issues")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Open Phases &#x2013; Count of active project phases/milestones")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Closed Phases &#x2013; Count of completed phases")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("My Tasks Widget")]
      }),

      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun("Displays a list of tasks assigned to the current user. Shows task names, projects, and status. Empty state message appears when no tasks are assigned to the user.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("My Issues Widget")]
      }),

      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun("Displays a list of issues assigned to the current user. Shows issue names, projects, and severity levels. Empty state message appears when no issues are assigned.")]
      }),

      // Section: Projects
      new Paragraph({ children: [new PageBreak()] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("4. Projects Section")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Projects Overview")]
      }),

      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun("The Projects section is the central hub for managing all projects in the workspace. It provides comprehensive filtering, viewing, and organization capabilities.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Project Tabs")]
      }),

      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("Projects can be filtered using five main tabs:")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Active Projects &#x2013; Currently running projects (default view)")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Project Templates &#x2013; Reusable project templates for quick setup")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Project Groups &#x2013; Projects organized into groups/collections")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Public Projects &#x2013; Projects shared with external users")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Archived Projects &#x2013; Completed/inactive projects")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Project List View Columns")]
      }),

      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("The projects list displays the following columns:")]
      }),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2340, 7020],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders, shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                width: { size: 2340, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: "Column Name", bold: true })] })]
              }),
              new TableCell({
                borders, shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
                width: { size: 7020, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true })] })]
              })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 2340, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("ID")] })] }),
              new TableCell({ borders, width: { size: 7020, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Unique project identifier")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 2340, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Project Name")] })] }),
              new TableCell({ borders, width: { size: 7020, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Name of the project")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 2340, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("% (Completion)")] })] }),
              new TableCell({ borders, width: { size: 7020, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Project completion percentage based on task progress")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 2340, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Owner")] })] }),
              new TableCell({ borders, width: { size: 7020, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Project owner/manager responsible for the project")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 2340, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Status")] })] }),
              new TableCell({ borders, width: { size: 7020, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Current project status (Active, On Hold, Completed)")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 2340, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Tasks")] })] }),
              new TableCell({ borders, width: { size: 7020, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Number of tasks in the project")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 2340, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Phases")] })] }),
              new TableCell({ borders, width: { size: 7020, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Number of phases/milestones in the project")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 2340, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Issues")] })] }),
              new TableCell({ borders, width: { size: 7020, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Number of issues logged for the project")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 2340, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Start Date")] })] }),
              new TableCell({ borders, width: { size: 7020, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Project start date")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 2340, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("End Date")] })] }),
              new TableCell({ borders, width: { size: 7020, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Project end date / deadline")] })] })
            ]
          }),
          new TableRow({
            children: [
              new TableCell({ borders, width: { size: 2340, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Tags")] })] }),
              new TableCell({ borders, width: { size: 7020, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun("Custom tags for categorizing and filtering projects")] })] })
            ]
          })
        ]
      }),

      new Paragraph({ spacing: { after: 240 }, children: [new TextRun("")] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Filtering and Controls")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("All Projects Dropdown &#x2013; Filter projects by custom groupings or saved views")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("List/Automation Toggle &#x2013; Switch between list view and automation view")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("New Project Button &#x2013; Launch the project creation wizard")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Automation Button &#x2013; Set up project automation rules")]
      }),

      // Section: Tasks
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("5. Tasks Section")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Tasks Overview")]
      }),

      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun("The Tasks section is where teams create, assign, and manage all project work. It provides comprehensive filtering, grouping, and view options for tracking task progress.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Task Filters")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("All Open &#x2013; Default filter showing tasks that are not yet completed")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Custom Filters &#x2013; Create saved views based on status, assignee, due date, etc.")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Status-based Filtering &#x2013; Filter by To Do, In Progress, Completed, On Hold, Cancelled")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Task Grouping")]
      }),

      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("Tasks can be grouped in various ways to organize work:")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Group by Task List &#x2013; Organize by custom task list/category")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Group by Assignee &#x2013; Organize by team member")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Group by Status &#x2013; Organize by task status (Open, In Progress, etc.)")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Group by Project &#x2013; Organize by project")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Group by Priority &#x2013; Organize by priority level")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Task Columns")]
      }),

      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("Tasks list displays these key columns:")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("ID &#x2013; Unique task identifier")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Task Name &#x2013; Task title/description")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Project &#x2013; Associated project")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Owner &#x2013; Task owner/assignee")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Status &#x2013; Current task status")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Tags &#x2013; Custom categorization tags")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Start Date &#x2013; When the task begins")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Due Date &#x2013; Task deadline")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Duration &#x2013; Estimated hours to complete")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Task Actions")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Add Task &#x2013; Create a new standalone task")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Add Task List &#x2013; Create a task list/category to organize related tasks")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Suggestions &#x2013; AI-powered task recommendations")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Automation &#x2013; Set up automated workflows for task management")]
      }),

      // Section: Issues
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("6. Issues Section")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Issues Overview")]
      }),

      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun("The Issues section is dedicated to tracking problems, bugs, and blockers in projects. It provides specialized workflows for issue resolution and severity tracking.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Issue Filtering")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("All Issues &#x2013; View all issues across projects")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Open Issues &#x2013; Issues awaiting resolution")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Closed Issues &#x2013; Resolved issues")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Custom Filters &#x2013; By severity, assignee, reporter, status, etc.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Issue Columns")]
      }),

      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("Issues are displayed with the following columns:")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("ID &#x2013; Unique issue identifier")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Issue Name &#x2013; Issue title/description")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Project &#x2013; Associated project")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Reporter &#x2013; Who logged the issue")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Created &#x2013; When the issue was created")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Assignee &#x2013; Who is resolving the issue")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Tags &#x2013; Categorization tags")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Last Closed &#x2013; When the issue was last closed")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Last Modified &#x2013; Last update timestamp")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Due Date &#x2013; Resolution deadline")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Status &#x2013; Open, In Progress, Closed, On Hold")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Severity &#x2013; Critical, High, Medium, Low")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Issue Actions")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Add Issues Name &#x2013; Create a new issue inline")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Submit Issue &#x2013; Formal issue submission with full details")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Group By None &#x2013; Flat list or customize grouping")]
      }),

      // Section: Phases
      new Paragraph({ children: [new PageBreak()] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("7. Phases/Milestones Section")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Phases Overview")]
      }),

      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun("Phases (also called Milestones) are major project deliverables or checkpoints. They serve as high-level organizational units for grouping related tasks and tracking progress toward project goals.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Phase Filtering")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("All Phases &#x2013; View all project phases")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Open Phases &#x2013; Active/in-progress phases")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Closed Phases &#x2013; Completed phases")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("By Project &#x2013; Filter phases by associated project")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Phase Columns")]
      }),

      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("Phases display the following columns:")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Phase Name &#x2013; Name/title of the phase")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Project &#x2013; Associated project")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("% (Completion) &#x2013; Completion percentage based on phase tasks")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Status &#x2013; Open or Closed")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Owner &#x2013; Phase owner/manager")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Start Date &#x2013; Phase start date")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("End Date &#x2013; Phase deadline")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Tasks &#x2013; Number of tasks in the phase")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Issues &#x2013; Number of issues associated with the phase")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Phase Actions")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Add Phase &#x2013; Create a new phase/milestone")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Group By None &#x2013; Flat list or grouping options")]
      }),

      // Section: Time Logs
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("8. Time Logs Section")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Time Logs Overview")]
      }),

      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun("Time Logs track the hours worked on tasks and projects. This data is essential for billing, capacity planning, and productivity analysis. Time logs are typically grouped by date and can be aggregated into timesheets.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Time Log Grouping")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Group By Date &#x2013; Default grouping showing logs organized by date")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Group By Week &#x2013; Weekly aggregation for summary view")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Group By User &#x2013; Organize by team member")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Group by Project &#x2013; Organize by project")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Time Log Filtering")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("All Time Logs &#x2013; View all time log entries")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Date Range Selector &#x2013; Filter by week or custom date range")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("By Status &#x2013; Filter by approval status (Approved, Pending, Rejected)")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Time Log Columns")]
      }),

      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("Time logs display these columns:")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("ID &#x2013; Unique log identifier")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Log Title &#x2013; Work description")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Project &#x2013; Associated project")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Timesheet Name &#x2013; Associated timesheet")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Daily Log Hours &#x2013; Hours logged for the day")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Time Period &#x2013; Date range of the log")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("User &#x2013; Who logged the time")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Billing Type &#x2013; Billable or Non-billable")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Approval Status &#x2013; Approval state")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Notes &#x2013; Additional comments")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Time Log Actions")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Add Time Log &#x2013; Create a new time entry")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Automation &#x2013; Set up automatic time log workflows")]
      }),

      // Section: Timesheets
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("9. Timesheets Section")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Timesheets Overview")]
      }),

      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun("Timesheets aggregate time logs for a period (typically weekly or monthly) and facilitate approval workflows. They enable managers to review and approve team members' work hours for billing and payroll.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Timesheet Filtering")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("All Timesheets &#x2013; View all submitted timesheets")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Added By &#x2013; Filter by who created the timesheet")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Approval Status &#x2013; Filter by Pending, Approved, or Rejected")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Clear Filter &#x2013; Reset all active filters")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Timesheet Columns")]
      }),

      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("Timesheets display these columns:")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Timesheet Name &#x2013; Identifier for the timesheet")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Time Period &#x2013; Start to end date for the timesheet")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Project Name &#x2013; Associated project")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Billing Type &#x2013; Billable or Non-billable hours")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Total Hours &#x2013; Sum of hours in the timesheet")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Approval Status &#x2013; Pending, Approved, or Rejected")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Added By &#x2013; Who created the timesheet")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Updated By &#x2013; Who last modified it")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Created Time &#x2013; Creation timestamp")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Modified By &#x2013; Who last changed it")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Timesheet Actions")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Create Timesheet &#x2013; Generate a new timesheet for a period")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Approval Rules &#x2013; Configure approval workflow policies")]
      }),

      // Section: Reports
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("10. Reports Section")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Reports Overview")]
      }),

      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun("Reports provide analytics and insights into project health, team productivity, and resource utilization. The system offers multiple report types with filtering and customization options.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Workload Report")]
      }),

      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("The primary report showing team member workload distribution:")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Report Type Dropdown &#x2013; Switch between Workload Report and other report types")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Task Owner Filter &#x2013; Filter by specific team member")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Date Range Selector &#x2013; Choose time period (monthly default)")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Status Filter &#x2013; Filter by All Open, Completed, In Progress, etc.")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Heatmap View &#x2013; Visual representation of workload per team member per day")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("User List &#x2013; Sidebar showing selectable users including &#x201C;Unassigned User&#x201D;")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Report Features")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Search User &#x2013; Quick search box to find team members")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Export Report &#x2013; Download report data as PDF or Excel")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Date Navigation &#x2013; Previous/next buttons to navigate report periods")]
      }),

      // Section: Collaboration
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("11. Collaboration Section")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Collaboration Overview")]
      }),

      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun("The Collaboration section provides tools for team communication and coordination. It includes feeds for activity updates, a calendar for scheduling, and chat for direct messaging.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Feed")]
      }),

      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("The Feed tab shows a timeline of project activities and updates:")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("All Feeds Filter &#x2013; View all activity or filter by specific feeds")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Feed Tab &#x2013; General project updates and announcements")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Status Tab &#x2013; Team member status updates")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Activity Stream Tab &#x2013; Detailed log of all project activities")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Comment Feature &#x2013; Add comments to feed items with timestamps")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Calendar")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Project Calendar &#x2013; Visual calendar showing project milestones and deadlines")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Event Creation &#x2013; Schedule meetings and project events")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Chat")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Direct Messaging &#x2013; Real-time chat with team members")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Group Chats &#x2013; Conversation threads for teams or projects")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("File Sharing &#x2013; Share documents and attachments in chat")]
      }),

      // Section: My Approvals
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("12. My Approvals Section")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Approvals Overview")]
      }),

      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun("The My Approvals section centralizes all pending approval items for the current user. This is primarily used for timesheet approval workflows where managers review and approve team member timesheets.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Approval Workflow")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Yet to Approve Filter &#x2013; Default view showing pending timesheets awaiting approval")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Timesheet List &#x2013; Detailed list of timesheets pending manager approval")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Approve/Reject Actions &#x2013; Buttons to approve or reject timesheets")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Approval Rules Button &#x2013; Configure approval policies and workflows")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Approval Columns")]
      }),

      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("Approval items display these columns:")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Timesheet Name")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Time Period")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Project Name")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Billing Type")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Total Hours")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Approval Status")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Added By")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Updated By")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Created Time")]
      }),

      // Section: Key Features & Best Practices
      new Paragraph({ children: [new PageBreak()] }),

      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("13. Key Features & Design Patterns")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Empty State Handling")]
      }),

      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun("When there are no items to display, the system shows clear empty state messages (e.g., &#x201C;No projects found,&#x201D; &#x201C;No Tasks assigned to you yet&#x201D;) with optional suggestions for next steps.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Filtering & Sorting")]
      }),

      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun("Most sections support multiple filter dimensions (status, assignee, date, priority, tags, etc.) with the ability to create and save custom views for quick access to frequently used filters.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("List View Options")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Default list view displays sortable, filterable columns")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Column selection allows customizing visible fields")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Inline editing for quick updates")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Export functionality for reporting and analysis")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Grouping Capabilities")]
      }),

      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun("Tasks, issues, and time logs can be grouped by multiple dimensions (project, assignee, status, date, etc.) to organize work in different ways for different team workflows.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Automation Framework")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Automation button in many sections enables rule creation")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Rules can trigger on status changes, assignments, or deadlines")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Actions include notifications, status updates, and task assignments")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Reduces manual tasks and improves workflow efficiency")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Real-Time Updates")]
      }),

      new Paragraph({
        spacing: { after: 240 },
        children: [new TextRun("Changes made by team members are reflected immediately in the system. The feed and activity stream provide real-time visibility into all project activities.")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("User Roles & Permissions")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Project Owner &#x2013; Full control over project settings, team, and content")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Manager &#x2013; Can approve timesheets and manage team assignments")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Team Member &#x2013; Can view assigned tasks/issues and log time")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Admin &#x2013; System-wide configuration and user management")]
      }),

      // Implementation Guide
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("14. Implementation Guide for TaskFlow")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Architecture Recommendations")]
      }),

      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("Based on this Zoho Projects analysis, here are key architectural recommendations for your TaskFlow project:")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Backend Architecture")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Multi-tenant data isolation &#x2013; Use database schemas or separate instances per tenant")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Entity relationships &#x2013; Projects contain Phases contain Tasks")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Separate Issue tracking module linked to projects")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Time tracking with timesheet aggregation")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Approval workflow engine for timesheets and items")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Frontend Architecture")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Modular feature-based organization (auth, projects, tasks, issues, etc.)")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Reusable table/list components with sorting, filtering, pagination")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Dynamic widget dashboard system")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Responsive design for desktop and mobile")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Real-time updates via WebSocket connections")]
      }),

      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun("Data Models to Implement")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0, level: 0 },
        children: [new TextRun("Project (id, name, owner, status, startDate, endDate, createdDate, tags)")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 1 },
        children: [new TextRun("Phase (id, name, projectId, owner, startDate, endDate, status, completion%)")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 1 },
        children: [new TextRun("Task (id, name, projectId, phaseId, assignee, status, priority, dueDate, startDate, estimatedHours, actualHours, tags)")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 1 },
        children: [new TextRun("Issue (id, name, projectId, reporter, assignee, severity, status, dueDate, createdDate, closedDate, tags)")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 1 },
        children: [new TextRun("TimeLog (id, taskId, userId, projectId, hoursLogged, logDate, billingType, approval Status, timesheetId, notes)")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 1 },
        children: [new TextRun("Timesheet (id, userId, timePeriodStart, timePeriodEnd, totalHours, approvalStatus, createdBy, createdDate)")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 1 },
        children: [new TextRun("User (id, name, email, role, avatar, status, lastActive)")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 1 },
        spacing: { after: 240 },
        children: [new TextRun("Comment/Activity (id, entityType, entityId, userId, content, createdDate, updatedDate)")]
      }),

      // Conclusion
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun("15. Conclusion")]
      }),

      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("This comprehensive documentation provides a detailed blueprint of Zoho Projects' functionality and interface. Key takeaways for your TaskFlow development:")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Focus on core features first: Projects, Tasks, Issues, Time Logs, and Timesheets")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Build flexible filtering and grouping into every list view")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Implement robust dashboard and empty state UX")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Plan for approval workflows and team collaboration from the start")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [new TextRun("Design with multi-tenancy in mind")]
      }),

      new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        spacing: { after: 240 },
        children: [new TextRun("Use WebSocket for real-time updates and notifications")]
      }),

      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun("This documentation serves as a specification for implementing a feature-rich project management platform that meets modern team collaboration needs.")]
      })
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/sessions/quirky-exciting-rubin/mnt/new task management/ZOHO_PROJECTS_COMPREHENSIVE_DOCUMENTATION.docx", buffer);
  console.log("Document created successfully!");
});
