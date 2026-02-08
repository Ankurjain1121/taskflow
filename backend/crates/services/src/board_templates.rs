use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardTemplate {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub columns: &'static [TemplateColumn],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateColumn {
    pub name: &'static str,
    pub color: &'static str,
    pub is_done: bool,
}

pub const TEMPLATES: &[BoardTemplate] = &[
    BoardTemplate {
        id: "blank",
        name: "Blank Board",
        description: "Start from scratch",
        columns: &[],
    },
    BoardTemplate {
        id: "kanban",
        name: "Basic Kanban",
        description: "Simple To Do, In Progress, Done workflow",
        columns: &[
            TemplateColumn { name: "To Do", color: "#6B7280", is_done: false },
            TemplateColumn { name: "In Progress", color: "#3B82F6", is_done: false },
            TemplateColumn { name: "Done", color: "#10B981", is_done: true },
        ],
    },
    BoardTemplate {
        id: "scrum",
        name: "Scrum Board",
        description: "Backlog through Done with review stage",
        columns: &[
            TemplateColumn { name: "Backlog", color: "#6B7280", is_done: false },
            TemplateColumn { name: "Sprint", color: "#8B5CF6", is_done: false },
            TemplateColumn { name: "In Progress", color: "#3B82F6", is_done: false },
            TemplateColumn { name: "Review", color: "#F59E0B", is_done: false },
            TemplateColumn { name: "Done", color: "#10B981", is_done: true },
        ],
    },
    BoardTemplate {
        id: "bug-tracker",
        name: "Bug Tracker",
        description: "Track bugs from report to resolution",
        columns: &[
            TemplateColumn { name: "Open", color: "#EF4444", is_done: false },
            TemplateColumn { name: "Triaging", color: "#F59E0B", is_done: false },
            TemplateColumn { name: "In Progress", color: "#3B82F6", is_done: false },
            TemplateColumn { name: "Testing", color: "#8B5CF6", is_done: false },
            TemplateColumn { name: "Resolved", color: "#10B981", is_done: true },
        ],
    },
    BoardTemplate {
        id: "content",
        name: "Content Pipeline",
        description: "Manage content from idea to publication",
        columns: &[
            TemplateColumn { name: "Ideas", color: "#6B7280", is_done: false },
            TemplateColumn { name: "Drafting", color: "#3B82F6", is_done: false },
            TemplateColumn { name: "Review", color: "#F59E0B", is_done: false },
            TemplateColumn { name: "Approved", color: "#8B5CF6", is_done: false },
            TemplateColumn { name: "Published", color: "#10B981", is_done: true },
        ],
    },
];

pub fn get_template(id: &str) -> Option<&'static BoardTemplate> {
    TEMPLATES.iter().find(|t| t.id == id)
}
