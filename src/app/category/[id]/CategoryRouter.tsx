'use client';
import dynamic from 'next/dynamic';
import type { ComponentProps, ComponentType } from 'react';
import { useIsMobile } from '@/components/device';
import DesktopCategoryClient from './CategoryClient';

type Props = ComponentProps<typeof DesktopCategoryClient>;

const MobileCategoryClient = dynamic<Props>(
    () => import('@/mobile/screens/category/[id]/CategoryClient').then(
        m => ({ default: m.default as unknown as ComponentType<Props> })
    ),
    { ssr: false }
);

export default function CategoryRouter(props: Props) {
    const isMobile = useIsMobile();
    const C = isMobile === true ? MobileCategoryClient : DesktopCategoryClient;
    return <C {...props} />;
}
