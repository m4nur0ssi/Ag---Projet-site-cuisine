'use client';
import WeekPlanner from '@/components/WeekPlanner/WeekPlanner';
export default function PlannerTestPage() {
    return <div style={{ minHeight: '100vh', background: '#0a0a0a' }}><WeekPlanner isOpen onClose={() => {}} /></div>;
}
