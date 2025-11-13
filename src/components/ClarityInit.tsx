"use client";

import { useEffect } from 'react';
import Clarity from '@microsoft/clarity';

export default function ClarityInit() {
  useEffect(() => {
    try {
      // 仅在浏览器环境初始化，避免 SSR 阶段报错
      if (typeof window !== 'undefined') {
        // 避免在开发模式下 React.StrictMode 导致的重复初始化
        const w = window as unknown as { __clarity_initialized?: boolean };
        if (!w.__clarity_initialized) {
          Clarity.init('u5c39vnoao');
          w.__clarity_initialized = true;
        }
      }
    } catch (e) {
      console.error('Clarity 初始化失败:', e);
    }
  }, []);
  return null;
}