use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct BoardTemplate {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub columns: &'static [TemplateColumn],
}

#[derive(Debug, Clone, Serialize)]
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn test_get_template_kanban() {
        let tmpl = get_template("kanban").expect("kanban template should exist");
        assert_eq!(tmpl.columns.len(), 3);
    }

    #[test]
    fn test_get_template_scrum() {
        let tmpl = get_template("scrum").expect("scrum template should exist");
        assert_eq!(tmpl.columns.len(), 5);
    }

    #[test]
    fn test_get_template_blank() {
        let tmpl = get_template("blank").expect("blank template should exist");
        assert_eq!(tmpl.columns.len(), 0);
    }

    #[test]
    fn test_get_template_bug_tracker() {
        let tmpl = get_template("bug-tracker");
        assert!(tmpl.is_some(), "bug-tracker template should exist");
    }

    #[test]
    fn test_get_template_invalid() {
        assert!(get_template("nonexistent").is_none());
    }

    #[test]
    fn test_templates_count() {
        assert_eq!(TEMPLATES.len(), 5);
    }

    #[test]
    fn test_kanban_done_column() {
        let tmpl = get_template("kanban").unwrap();
        let last = tmpl.columns.last().expect("kanban should have columns");
        assert!(last.is_done, "Last kanban column should have is_done=true");
    }

    #[test]
    fn test_all_templates_have_unique_ids() {
        let mut ids = HashSet::new();
        for tmpl in TEMPLATES {
            assert!(
                ids.insert(tmpl.id),
                "Duplicate template ID found: {}",
                tmpl.id
            );
        }
    }
}
