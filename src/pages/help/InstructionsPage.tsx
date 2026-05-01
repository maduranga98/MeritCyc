import React, { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Users, TrendingUp, BarChart3, Settings, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Feature {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  steps: string[];
}

const InstructionsPage: React.FC = () => {
  const [expandedId, setExpandedId] = useState<string | null>('cycles');

  const features: Feature[] = [
    {
      id: 'cycles',
      title: 'Manage Increment Cycles',
      icon: <Zap className="w-6 h-6" />,
      description: 'Create and manage merit increment cycles with budgets and evaluation criteria.',
      steps: [
        'Navigate to "Cycles" in the main menu',
        'Click "Create New Cycle" button',
        'Fill in basic cycle information (name, fiscal year, dates)',
        'Define the scope (departments, salary bands)',
        'Set budget allocation and constraints',
        'Configure evaluation criteria and scoring templates',
        'Review and finalize the cycle',
        'Managers can now evaluate employees within this cycle'
      ]
    },
    {
      id: 'evaluations',
      title: 'Manage Evaluations & Scoring',
      icon: <TrendingUp className="w-6 h-6" />,
      description: 'Review and finalize manager evaluations with score overrides and audit trails.',
      steps: [
        'Go to "Evaluations" > "Review Scores"',
        'Select a cycle to review',
        'View manager-submitted evaluations and scores',
        'Use the "Override Score" panel to adjust scores with justification if needed',
        'Add audit notes explaining any changes',
        'Review all evaluations for consistency',
        'Once complete, click "Finalize Cycle" to lock evaluations',
        'Generate reports for payroll integration'
      ]
    },
    {
      id: 'budget',
      title: 'Budget Simulation & Planning',
      icon: <BarChart3 className="w-6 h-6" />,
      description: 'Run what-if scenarios to model budget impact before finalizing increments.',
      steps: [
        'Open a cycle and navigate to "Simulate Budget"',
        'View current evaluation distribution',
        'Adjust sliders to model different scenarios:',
        '  - Score threshold (minimum score to receive increment)',
        '  - Budget cap (max percentage increase)',
        '  - Department overrides',
        'View real-time impact on employee distribution and total spend',
        'Apply approved scenario to the cycle',
        'Compare scenarios side-by-side for analysis'
      ]
    },
    {
      id: 'people',
      title: 'Manage People & Organization',
      icon: <Users className="w-6 h-6" />,
      description: 'Maintain employee records, departments, salary bands, and role assignments.',
      steps: [
        'Access "People" menu to manage:',
        '  - Employee Directory: View all employees, add new hires',
        '  - Departments: Create and configure departments',
        '  - Salary Bands: Define pay grades and ranges',
        '  - Invites: Send registration links to new admins/managers',
        'For each employee, view:',
        '  - Overview tab: Basic info and current role',
        '  - Increment History: Past cycles and outcomes',
        '  - Activity: Recent changes and events',
        'Use filters to find specific employees or groups',
        'Export employee data for external systems'
      ]
    },
    {
      id: 'analytics',
      title: 'Analytics & Fairness Reports',
      icon: <BarChart3 className="w-6 h-6" />,
      description: 'Analyze pay equity, distribution trends, and department performance.',
      steps: [
        'Navigate to "Analytics" for comprehensive insights:',
        '  - Executive Dashboard: High-level metrics and trends',
        '  - Department Analytics: Performance by department',
        '  - Year-over-Year Comparison: Trend analysis across cycles',
        'Access "Fairness" to review pay equity:',
        '  - Gender pay gap analysis',
        '  - Department comparison',
        '  - Manager consistency scores',
        '  - Export PDF reports for governance',
        'Use "Audit Trail" to track all system changes',
        'Filter by date, action type, and user for compliance'
      ]
    },
    {
      id: 'settings',
      title: 'Configure Settings',
      icon: <Settings className="w-6 h-6" />,
      description: 'Manage company settings, registration, notifications, and security.',
      steps: [
        'Go to "Settings" to configure:',
        '  - General: Company name, timezone, business rules',
        '  - Registration: Self-registration options for employees',
        '  - Notifications: Email templates and notification rules',
        '  - Security: Password policies, session timeouts',
        '  - Data Privacy: Data retention and export settings',
        'Generate data export (ZIP) for backup or compliance',
        'Manage notification recipients and schedules',
        'Configure custom business rules for your organization'
      ]
    },
    {
      id: 'approvals',
      title: 'Approve New Registrations',
      icon: <Users className="w-6 h-6" />,
      description: 'Review and approve pending employee and manager registrations.',
      steps: [
        'Go to "HR Approvals" to see pending registrations',
        'Review applicant information:',
        '  - Name, email, department',
        '  - Requested role and manager assignment',
        '  - Registration details',
        'For each applicant:',
        '  - Click "Approve" to confirm registration',
        '  - Or "Request Info" to ask for more details',
        '  - Or "Reject" if not authorized',
        'Bulk actions: Select multiple to approve/reject at once',
        'Track approval history and timeline'
      ]
    }
  ];

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-merit-bg py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-lg bg-merit-emerald/10 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-merit-emerald" />
            </div>
            <h1 className="text-4xl font-bold text-merit-navy">MeritCyc Help & Instructions</h1>
          </div>
          <p className="text-merit-slate text-lg">
            Learn how to use MeritCyc's admin features to manage merit cycles, evaluations, and payroll decisions.
          </p>
        </div>

        {/* Features List */}
        <div className="space-y-4">
          {features.map((feature) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Feature Header */}
              <button
                onClick={() => toggleExpand(feature.id)}
                className="w-full px-6 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-merit-emerald/10 flex items-center justify-center text-merit-emerald mt-1">
                  {feature.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-merit-navy mb-1">
                    {feature.title}
                  </h2>
                  <p className="text-merit-slate text-sm">
                    {feature.description}
                  </p>
                </div>
                <div className="flex-shrink-0 text-merit-slate mt-1">
                  {expandedId === feature.id ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </button>

              {/* Feature Details */}
              <AnimatePresence>
                {expandedId === feature.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                      <h3 className="text-sm font-semibold text-merit-navy mb-4">How to use:</h3>
                      <ol className="space-y-3">
                        {feature.steps.map((step, index) => (
                          <li key={index} className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-merit-emerald text-white flex items-center justify-center text-sm font-semibold">
                              {index + 1}
                            </span>
                            <span className="text-merit-slate text-sm leading-relaxed pt-0.5">
                              {step}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Quick Tips Section */}
        <div className="mt-12 bg-merit-emerald/5 rounded-lg border border-merit-emerald/20 p-6">
          <h3 className="text-lg font-semibold text-merit-navy mb-4">Quick Tips for Success</h3>
          <ul className="space-y-3">
            <li className="flex gap-3">
              <span className="text-merit-emerald font-bold">💡</span>
              <span className="text-merit-slate">
                <strong>Plan ahead:</strong> Create cycles with sufficient lead time for managers to complete evaluations.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-merit-emerald font-bold">💡</span>
              <span className="text-merit-slate">
                <strong>Use simulations:</strong> Always run budget scenarios before finalizing to understand financial impact.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-merit-emerald font-bold">💡</span>
              <span className="text-merit-slate">
                <strong>Review fairness:</strong> Check pay equity reports before payroll to ensure compliance.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-merit-emerald font-bold">💡</span>
              <span className="text-merit-slate">
                <strong>Track audit trail:</strong> Use audit logs for compliance and to understand historical decisions.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-merit-emerald font-bold">💡</span>
              <span className="text-merit-slate">
                <strong>Communicate clearly:</strong> Ensure managers understand evaluation criteria before the cycle starts.
              </span>
            </li>
          </ul>
        </div>

        {/* Need Help Section */}
        <div className="mt-8 text-center">
          <p className="text-merit-slate text-sm">
            Can't find what you're looking for? Contact your system administrator or support team.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InstructionsPage;
