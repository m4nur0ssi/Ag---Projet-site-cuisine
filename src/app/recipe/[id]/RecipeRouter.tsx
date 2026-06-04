'use client';
import dynamic from 'next/dynamic';
import type { ComponentProps, ComponentType } from 'react';
import { useIsMobile } from '@/components/device';
import DesktopRecipeClient from './RecipeClient';

type Props = ComponentProps<typeof DesktopRecipeClient>;

const MobileRecipeClient = dynamic<Props>(
    () => import('@/mobile/screens/recipe/[id]/RecipeClient').then(
        m => ({ default: m.default as unknown as ComponentType<Props> })
    ),
    { ssr: false }
);

export default function RecipeRouter(props: Props) {
    const isMobile = useIsMobile();
    const C = isMobile === true ? MobileRecipeClient : DesktopRecipeClient;
    return <C {...props} />;
}
