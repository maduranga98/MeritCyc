import React, { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Users, TrendingUp, BarChart3, Settings, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface Feature {
  id: string;
  icon: React.ReactNode;
}

const FEATURES: Feature[] = [
  { id: 'cycles', icon: <Zap className="w-6 h-6" /> },
  { id: 'evaluations', icon: <TrendingUp className="w-6 h-6" /> },
  { id: 'budget', icon: <BarChart3 className="w-6 h-6" /> },
  { id: 'people', icon: <Users className="w-6 h-6" /> },
  { id: 'analytics', icon: <BarChart3 className="w-6 h-6" /> },
  { id: 'settings', icon: <Settings className="w-6 h-6" /> },
  { id: 'approvals', icon: <Users className="w-6 h-6" /> },
];

const InstructionsPage: React.FC = () => {
  const [expandedId, setExpandedId] = useState<string | null>('cycles');
  const { t } = useTranslation();

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
            <h1 className="text-4xl font-bold text-merit-navy">{t('help.pageTitle')}</h1>
          </div>
          <p className="text-merit-slate text-lg">
            {t('help.pageSubtitle')}
          </p>
        </div>

        {/* Features List */}
        <div className="space-y-4">
          {FEATURES.map((feature) => {
            const steps = t(`help.features.${feature.id}.steps`, { returnObjects: true }) as string[];
            return (
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
                      {t(`help.features.${feature.id}.title`)}
                    </h2>
                    <p className="text-merit-slate text-sm">
                      {t(`help.features.${feature.id}.description`)}
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
                        <h3 className="text-sm font-semibold text-merit-navy mb-4">{t('help.howToUse')}</h3>
                        <ol className="space-y-3">
                          {steps.map((step, index) => (
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
            );
          })}
        </div>

        {/* Quick Tips Section */}
        <div className="mt-12 bg-merit-emerald/5 rounded-lg border border-merit-emerald/20 p-6">
          <h3 className="text-lg font-semibold text-merit-navy mb-4">{t('help.quickTips')}</h3>
          <ul className="space-y-3">
            {(['planAhead', 'useSimulations', 'reviewFairness', 'trackAuditTrail', 'communicateClearly'] as const).map((tipKey) => (
              <li key={tipKey} className="flex gap-3">
                <span className="text-merit-emerald font-bold">💡</span>
                <span
                  className="text-merit-slate"
                  dangerouslySetInnerHTML={{ __html: t(`help.tips.${tipKey}`) }}
                />
              </li>
            ))}
          </ul>
        </div>

        {/* Need Help Section */}
        <div className="mt-8 text-center">
          <p className="text-merit-slate text-sm">
            {t('help.notFound')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default InstructionsPage;
