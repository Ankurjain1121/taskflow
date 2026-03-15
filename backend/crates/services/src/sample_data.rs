//! Static template data for sample board generation.
//!
//! Contains all template definitions (columns, tasks, labels) for each use-case
//! (software, marketing, personal, design).

#![allow(dead_code)]

// ============================================================================
// Template data structures
// ============================================================================

pub(super) struct TemplateConfig {
    pub board_name: &'static str,
    pub board_description: &'static str,
    pub columns: &'static [ColumnDef],
    pub tasks: &'static [TaskDef],
    pub labels: &'static [LabelDef],
}

pub(super) struct ColumnDef {
    pub name: &'static str,
    pub color: &'static str,
    pub is_done: bool,
}

pub(super) struct TaskDef {
    pub title: &'static str,
    pub column_index: usize,
    pub priority: &'static str,
    pub due_day_offset: Option<i64>,
    pub subtasks: &'static [&'static str],
    pub label_index: usize,
}

pub(super) struct LabelDef {
    pub name: &'static str,
    pub color: &'static str,
}

// ============================================================================
// Template definitions
// ============================================================================

static SOFTWARE_COLUMNS: &[ColumnDef] = &[
    ColumnDef {
        name: "Backlog",
        color: "#94a3b8",
        is_done: false,
    },
    ColumnDef {
        name: "To Do",
        color: "#6366f1",
        is_done: false,
    },
    ColumnDef {
        name: "In Progress",
        color: "#3b82f6",
        is_done: false,
    },
    ColumnDef {
        name: "Code Review",
        color: "#f59e0b",
        is_done: false,
    },
    ColumnDef {
        name: "Done",
        color: "#22c55e",
        is_done: true,
    },
];

static SOFTWARE_LABELS: &[LabelDef] = &[
    LabelDef {
        name: "Bug",
        color: "#ef4444",
    },
    LabelDef {
        name: "Feature",
        color: "#3b82f6",
    },
    LabelDef {
        name: "Tech Debt",
        color: "#f59e0b",
    },
];

static SOFTWARE_TASKS: &[TaskDef] = &[
    TaskDef {
        title: "Set up CI/CD pipeline",
        column_index: 0,
        priority: "high",
        due_day_offset: Some(2),
        subtasks: &[
            "Configure GitHub Actions workflow",
            "Add deployment scripts",
            "Set up staging environment",
        ],
        label_index: 0,
    },
    TaskDef {
        title: "Design user authentication",
        column_index: 0,
        priority: "high",
        due_day_offset: Some(5),
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Create API documentation",
        column_index: 1,
        priority: "medium",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Fix login page bug",
        column_index: 1,
        priority: "medium",
        due_day_offset: Some(3),
        subtasks: &["Reproduce the issue", "Write failing test"],
        label_index: 0,
    },
    TaskDef {
        title: "Add dark mode support",
        column_index: 2,
        priority: "medium",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Write unit tests for auth",
        column_index: 2,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Implement search feature",
        column_index: 3,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Review pull request #42",
        column_index: 4,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
];

static MARKETING_COLUMNS: &[ColumnDef] = &[
    ColumnDef {
        name: "Ideas",
        color: "#a78bfa",
        is_done: false,
    },
    ColumnDef {
        name: "Planning",
        color: "#6366f1",
        is_done: false,
    },
    ColumnDef {
        name: "In Progress",
        color: "#3b82f6",
        is_done: false,
    },
    ColumnDef {
        name: "Review",
        color: "#f59e0b",
        is_done: false,
    },
    ColumnDef {
        name: "Published",
        color: "#22c55e",
        is_done: true,
    },
];

static MARKETING_LABELS: &[LabelDef] = &[
    LabelDef {
        name: "Content",
        color: "#8b5cf6",
    },
    LabelDef {
        name: "Social",
        color: "#3b82f6",
    },
    LabelDef {
        name: "Email",
        color: "#f59e0b",
    },
];

static MARKETING_TASKS: &[TaskDef] = &[
    TaskDef {
        title: "Write blog post on product launch",
        column_index: 0,
        priority: "high",
        due_day_offset: Some(3),
        subtasks: &["Research keywords", "Write draft", "Create featured image"],
        label_index: 0,
    },
    TaskDef {
        title: "Design social media graphics",
        column_index: 0,
        priority: "high",
        due_day_offset: Some(5),
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Plan email newsletter",
        column_index: 1,
        priority: "medium",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Create landing page copy",
        column_index: 1,
        priority: "medium",
        due_day_offset: Some(4),
        subtasks: &["Write headline options", "Draft body copy"],
        label_index: 0,
    },
    TaskDef {
        title: "Set up analytics tracking",
        column_index: 2,
        priority: "medium",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Schedule social media posts",
        column_index: 2,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Review competitor analysis",
        column_index: 3,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Film product demo video",
        column_index: 4,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
];

static PERSONAL_COLUMNS: &[ColumnDef] = &[
    ColumnDef {
        name: "To Do",
        color: "#6366f1",
        is_done: false,
    },
    ColumnDef {
        name: "Doing",
        color: "#3b82f6",
        is_done: false,
    },
    ColumnDef {
        name: "Waiting",
        color: "#f59e0b",
        is_done: false,
    },
    ColumnDef {
        name: "Done",
        color: "#22c55e",
        is_done: true,
    },
];

static PERSONAL_LABELS: &[LabelDef] = &[
    LabelDef {
        name: "Health",
        color: "#22c55e",
    },
    LabelDef {
        name: "Learning",
        color: "#3b82f6",
    },
    LabelDef {
        name: "Home",
        color: "#f59e0b",
    },
];

static PERSONAL_TASKS: &[TaskDef] = &[
    TaskDef {
        title: "Plan weekend project",
        column_index: 0,
        priority: "high",
        due_day_offset: Some(2),
        subtasks: &["Gather materials", "Sketch out plan"],
        label_index: 0,
    },
    TaskDef {
        title: "Read Atomic Habits book",
        column_index: 0,
        priority: "high",
        due_day_offset: Some(7),
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Organize digital photos",
        column_index: 0,
        priority: "medium",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Learn basic cooking recipes",
        column_index: 1,
        priority: "medium",
        due_day_offset: Some(5),
        subtasks: &[
            "Find 3 simple recipes",
            "Buy ingredients",
            "Cook first meal",
        ],
        label_index: 0,
    },
    TaskDef {
        title: "Set up home office",
        column_index: 1,
        priority: "medium",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Create monthly budget",
        column_index: 2,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Exercise 3x this week",
        column_index: 2,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Call dentist for appointment",
        column_index: 3,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
];

static DESIGN_COLUMNS: &[ColumnDef] = &[
    ColumnDef {
        name: "Research",
        color: "#a78bfa",
        is_done: false,
    },
    ColumnDef {
        name: "Wireframes",
        color: "#6366f1",
        is_done: false,
    },
    ColumnDef {
        name: "Design",
        color: "#3b82f6",
        is_done: false,
    },
    ColumnDef {
        name: "Feedback",
        color: "#f59e0b",
        is_done: false,
    },
    ColumnDef {
        name: "Shipped",
        color: "#22c55e",
        is_done: true,
    },
];

static DESIGN_LABELS: &[LabelDef] = &[
    LabelDef {
        name: "UX Research",
        color: "#8b5cf6",
    },
    LabelDef {
        name: "UI Design",
        color: "#3b82f6",
    },
    LabelDef {
        name: "Prototype",
        color: "#f59e0b",
    },
];

static DESIGN_TASKS: &[TaskDef] = &[
    TaskDef {
        title: "Create user persona cards",
        column_index: 0,
        priority: "high",
        due_day_offset: Some(2),
        subtasks: &[
            "Conduct user interviews",
            "Synthesize findings",
            "Design persona templates",
        ],
        label_index: 0,
    },
    TaskDef {
        title: "Wireframe onboarding flow",
        column_index: 0,
        priority: "high",
        due_day_offset: Some(4),
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Design component library",
        column_index: 1,
        priority: "medium",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Prototype mobile navigation",
        column_index: 1,
        priority: "medium",
        due_day_offset: Some(6),
        subtasks: &["Map navigation structure", "Create clickable prototype"],
        label_index: 0,
    },
    TaskDef {
        title: "Conduct usability test",
        column_index: 2,
        priority: "medium",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Design dark mode palette",
        column_index: 2,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Create icon set",
        column_index: 3,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
    TaskDef {
        title: "Review design system tokens",
        column_index: 4,
        priority: "low",
        due_day_offset: None,
        subtasks: &[],
        label_index: 0,
    },
];

pub(super) static SOFTWARE_TEMPLATE: TemplateConfig = TemplateConfig {
    board_name: "Dev Board",
    board_description: "Your software development task board",
    columns: SOFTWARE_COLUMNS,
    tasks: SOFTWARE_TASKS,
    labels: SOFTWARE_LABELS,
};

pub(super) static MARKETING_TEMPLATE: TemplateConfig = TemplateConfig {
    board_name: "Campaign Tracker",
    board_description: "Track your marketing campaigns and content",
    columns: MARKETING_COLUMNS,
    tasks: MARKETING_TASKS,
    labels: MARKETING_LABELS,
};

pub(super) static PERSONAL_TEMPLATE: TemplateConfig = TemplateConfig {
    board_name: "My Projects",
    board_description: "Organize your personal tasks and goals",
    columns: PERSONAL_COLUMNS,
    tasks: PERSONAL_TASKS,
    labels: PERSONAL_LABELS,
};

pub(super) static DESIGN_TEMPLATE: TemplateConfig = TemplateConfig {
    board_name: "Design Board",
    board_description: "Your design task workflow",
    columns: DESIGN_COLUMNS,
    tasks: DESIGN_TASKS,
    labels: DESIGN_LABELS,
};

pub(super) fn get_template(use_case: &str) -> &'static TemplateConfig {
    match use_case {
        "marketing" => &MARKETING_TEMPLATE,
        "personal" => &PERSONAL_TEMPLATE,
        "design" => &DESIGN_TEMPLATE,
        _ => &SOFTWARE_TEMPLATE,
    }
}
