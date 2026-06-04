"use client";

import { useState, useRef, useCallback, memo } from "react";

const PATTERN_COUNT = 144;

export const HeroSection = memo(function HeroSection() {
  const [flipped, setFlipped] = useState(false);
  const frontRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = frontRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--hero-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--hero-y", `${e.clientY - rect.top}px`);
  }, []);

  return (
    <section
      className={`hero-section ${flipped ? "hero-flipped" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => setFlipped((f) => !f)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFlipped((f) => !f); } }}
    >
      <div className="hero-flipper">
        {/* Front */}
        <div className="hero-front" ref={frontRef} onMouseEnter={updatePosition} onMouseMove={updatePosition}>
          <div className="hero-pattern" aria-hidden="true">
            {Array.from({ length: PATTERN_COUNT }, (_, i) => (
              <span key={i} className="hero-pattern-text">B I L L I O N A I R E</span>
            ))}
          </div>
          <div className="hero-reveal-layer" aria-hidden="true">
            <div className="hero-reveal-text-wrap">
              {Array.from({ length: PATTERN_COUNT }, (_, i) => (
                <span key={i} className="hero-reveal-text">B I L L I O N A I R E</span>
              ))}
            </div>
          </div>
          <div className="hero-content">
            <h1 className="hero-title">你好，billionaire</h1>
            <p className="hero-subtitle">
              探索 AI 与数字生活的无限可能 — 分享前沿工具、效率技巧和生活方式的思考。
            </p>
            <p className="hero-hint">点击了解更多</p>
          </div>
          <div className="hero-content-en">
            <h1 className="hero-title">HELLO, BILLIONAIRE</h1>
            <p className="hero-subtitle">
              Exploring the infinite possibilities of AI and digital life — sharing cutting-edge tools, productivity tips, and lifestyle insights.
            </p>
            <p className="hero-hint">Click to learn more</p>
          </div>
        </div>

        {/* Back */}
        <div className="hero-back">
          <div className="hero-back-content">
            <h2>关于 billionaire</h2>
            <p>
              探索 AI 与数字生活的无限可能 — 这里分享前沿工具、效率技巧和生活方式的思考。
              用技术驱动创作，用代码探索世界。
            </p>
            <p>
              写代码、聊 AI、玩工具、谈生活 — 一个开发者的数字生活实验室。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
});
