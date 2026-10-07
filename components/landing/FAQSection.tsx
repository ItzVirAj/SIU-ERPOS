"use client";

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

interface FAQSectionProps {
  className?: string;
}

const faqData = [
  {
    question: "What is SketchItUp Task Management Suite?",
    answer: "SketchItUp Task Management Suite is the official workflow, issue, and sprint tracking platform engineered by the creators of SketchItUp ERP. It unifies operations, manufacturing, engineering, and administrative tasks into a clean, modern, and agile interface."
  },
  {
    question: "How does it integrate with the SketchItUp ERP platform?",
    answer: "It features native two-way synchronization with core ERP modules including inventory batches, purchase orders, financial accounting records, and client deliverables. Any change in task state is mirrored across your ERP telemetry."
  },
  {
    question: "Can departments use this suite standalone?",
    answer: "Yes! While designed to work in synergy with the full SketchItUp ERP platform, teams and individual business units can use the Task Management Suite as an autonomous high-velocity task and Kanban manager."
  },
  {
    question: "How does SketchItUp AI assist our teams?",
    answer: "SketchItUp AI allows team members to create tasks, triage backlogs, and assign work using natural language. It understands organizational context and can parse operational requests into structured issues instantly."
  },
  {
    question: "What enterprise security and access controls are supported?",
    answer: "We support granular role-based access control (RBAC), departmental workspace isolation, comprehensive audit logs, and secure authentication to guarantee compliance with enterprise security standards."
  },
  {
    question: "Can we collaborate with external contractors or vendors?",
    answer: "Yes. Workspaces support role-scoped invites, allowing you to bring suppliers, contractors, and external partners into specific project boards without exposing wider ERP data."
  }
];

export const FAQSection: React.FC<FAQSectionProps> = ({ className = '' }) => {
  return (
    <div id="faq" className={`w-full py-16 md:py-24 relative ${className}`}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-3 px-3 py-1 text-primary border-primary/20 bg-primary/5">
            Got Questions?
          </Badge>
          <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground mb-3">
            Frequently Asked <span className="font-semibold text-primary">Questions</span>
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            Everything you need to know about SketchItUp Task Management Suite and ERP integration.
          </p>
        </div>

        {/* Accordion */}
        <Accordion type="single" collapsible className="w-full space-y-2">
          {faqData.map((faq, index) => (
            <AccordionItem 
              key={index} 
              value={`item-${index}`} 
              className="border border-border/80 rounded-xl px-5 py-1 bg-card/40"
            >
              <AccordionTrigger className="text-left text-base font-medium py-4 hover:no-underline text-foreground">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4 pt-1">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
};
