import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { problemCarouselImages, type Locale, type SiteContent } from "@/content/site-content";

import { SiteHeader } from "./site-header";

interface HomePageProps {
  locale: Locale;
  content: SiteContent;
}

export function HomePage({ locale, content }: HomePageProps) {
  const year = new Date().getFullYear();
  const heroPromptOptions = useMemo(() => {
    if (content.hero.promptOptions.length > 0) {
      return content.hero.promptOptions;
    }

    return [
      {
        image: "/web/patio-table-and-chairs.jpg",
        imageAlt: content.hero.imageAlt,
        promptText: content.hero.promptText
      }
    ];
  }, [content.hero.imageAlt, content.hero.promptOptions, content.hero.promptText]);
  const [activeHeroPromptIndex, setActiveHeroPromptIndex] = useState(0);
  const activeHeroPrompt = heroPromptOptions[activeHeroPromptIndex];
  const [typedPromptLength, setTypedPromptLength] = useState(0);
  const typewriterSpeedMs = 28;
  const promptHoldMs = 2200;

  useEffect(() => {
    setTypedPromptLength(0);
  }, [activeHeroPromptIndex]);

  useEffect(() => {
    if (typedPromptLength >= activeHeroPrompt.promptText.length) {
      return;
    }

    const typingTimeout = window.setTimeout(() => {
      setTypedPromptLength((currentLength) => currentLength + 1);
    }, typewriterSpeedMs);

    return () => window.clearTimeout(typingTimeout);
  }, [activeHeroPrompt.promptText, typedPromptLength]);

  useEffect(() => {
    if (heroPromptOptions.length < 2) {
      return;
    }

    const fullCycleMs = activeHeroPrompt.promptText.length * typewriterSpeedMs + promptHoldMs;
    const rotationTimeout = window.setTimeout(() => {
      setActiveHeroPromptIndex((currentIndex) => (currentIndex + 1) % heroPromptOptions.length);
    }, fullCycleMs);

    return () => window.clearTimeout(rotationTimeout);
  }, [activeHeroPrompt.promptText, activeHeroPromptIndex, heroPromptOptions.length]);

  return (
    <div className="theme-light">
      <div className="container page-shell">
        <SiteHeader
          locale={locale}
          content={content}
          links={[
            { href: "#problem", label: content.nav.problem },
            { href: "#use-cases", label: content.nav.useCases },
            { href: "#how", label: content.nav.how },
            { href: "#preview", label: content.nav.preview },
            { href: "/developers", label: content.nav.developers }
          ]}
        />

        <main>
          <section className="hero">
            <div className="hero-content">
              <h1>
                {content.hero.title} <i>{content.hero.titleAccent}</i>
              </h1>
              <p>{content.hero.body}</p>
              <div className="hero-actions">
                <a href="https://chatgpt.com" target="_blank" rel="noreferrer" className="btn btn-primary">
                  {content.hero.primaryCta}
                </a>
                <Link href="/developers" locale={locale} className="btn btn-outline">
                  {content.hero.secondaryCta}
                </Link>
              </div>
              <ul className="checks">
                {content.hero.checks.map((check) => (
                  <li key={check}>{check}</li>
                ))}
              </ul>
            </div>

            <div className="hero-image-wrap">
              {heroPromptOptions.map((option, index) => (
                <img
                  key={`${option.image}-${index}`}
                  src={option.image}
                  alt={option.imageAlt}
                  className={`hero-image ${index === activeHeroPromptIndex ? "hero-image-active" : ""}`}
                />
              ))}
              <div className="hero-caption">
                <strong>{content.hero.promptLabel}</strong>
                <div className="chat-text">
                  {activeHeroPrompt.promptText.slice(0, typedPromptLength)}
                  <span className="chat-cursor" aria-hidden="true">
                    |
                  </span>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      <section id="problem">
        <div className="container">
          <div className="statement-box">
            <div className="section-head">
              <span className="eyebrow">{content.problem.eyebrow}</span>
              <h2>
                {content.problem.title}
                <br />
                <i>{content.problem.titleAccent}</i>
              </h2>
            </div>

            {content.problem.paragraphs.map((paragraph) => (
              <p key={paragraph} className="section-copy problem-copy">
                {paragraph}
              </p>
            ))}

            <div className="problem-carousel">
              <div className="problem-track">
                {[...problemCarouselImages, ...problemCarouselImages].map((image, index) => (
                  <div className="problem-slide" key={`${image}-${index}`}>
                    <img src={image} alt="Propiedad en España" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="use-cases">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{content.useCases.eyebrow}</span>
            <h2>{content.useCases.title}</h2>
            <p className="section-copy">{content.useCases.intro}</p>
          </div>

          <div className="use-case-list">
            {content.useCases.items.map((item) => (
              <article className="use-case-row" key={item.title}>
                <div className="use-case-media">
                  <img src={item.image} alt={item.alt} loading="lazy" />
                </div>
                <div className="use-case-content">
                  <span className="use-case-tag">{item.tag}</span>
                  <h3>{item.title}</h3>
                  <p className="summary">{item.summary}</p>
                  <ul className="use-case-points">
                    {item.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{content.how.eyebrow}</span>
            <h2>
              {content.how.title}
              <br />
              <i>{content.how.titleAccent}</i>
            </h2>
            <p className="section-copy">{content.how.intro}</p>
          </div>

          <div className="grid-3">
            {content.how.steps.map((step, index) => (
              <article className="step-card" key={step.title}>
                <div className="step-number grainy-blob">{index + 1}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="preview" className="preview-section">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{content.preview.eyebrow}</span>
            <h2>
              {content.preview.title}
              <br />
              <i>{content.preview.titleAccent}</i>
            </h2>
            <p className="section-copy">{content.preview.intro}</p>
          </div>
        </div>

        <div className="preview-shell">
          <div className="container">
            <div className="preview-meta">
              <span>{content.preview.metaLeft}</span>
              <span>{content.preview.metaRight}</span>
            </div>

            <div className="cards-rail">
              {content.preview.cards.map((card) => (
                <article className="listing-card" key={card.title}>
                  <img src={card.image} alt={card.alt} loading="lazy" />
                  <div className="card-body">
                    <h3>{card.title}</h3>
                    <p className="meta">{card.meta}</p>
                    <p className="price">{card.price}</p>
                    <span className="open-tag">{content.preview.sourceTag}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="trust">
        <div className="container">
          <div className="statement-box statement-box-outline">
            <div className="section-head">
              <span className="eyebrow center">{content.trust.eyebrow}</span>
              <h2>
                {content.trust.title}
                <i> {content.trust.titleAccent}</i>
              </h2>
            </div>
            <p className="section-copy problem-copy">{content.trust.body}</p>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="container">
          <span className="eyebrow">{content.finalCta.eyebrow}</span>
          <h2>
            {content.finalCta.title} <i>{content.finalCta.titleAccent}</i>
          </h2>
          <p>{content.finalCta.body}</p>
          <div className="final-actions">
            <a href="https://chatgpt.com" target="_blank" rel="noreferrer" className="btn btn-primary">
              {content.finalCta.primary}
            </a>
            <Link href="/developers" locale={locale} className="btn btn-outline">
              {content.finalCta.secondary}
            </Link>
          </div>
        </div>
      </section>

      <div className="container">
        <footer>
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="footer-logo-wrap">
                <img src="/web/fynlogo.png" alt="Fyn logo" className="logo-img" />
                <div className="footer-logo-text">Fyn.</div>
              </div>
              <p>{content.footer.description}</p>
            </div>

            <div>
              <h4 className="footer-heading">{content.footer.productTitle}</h4>
              <ul className="footer-list">
                <li>
                  <a href="#problem">{content.nav.problem}</a>
                </li>
                <li>
                  <a href="#use-cases">{content.nav.useCases}</a>
                </li>
                <li>
                  <a href="https://chatgpt.com" target="_blank" rel="noreferrer">
                    {content.footer.tryChatgpt}
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="footer-heading">{content.footer.developersTitle}</h4>
              <ul className="footer-list">
                <li>
                  <Link href="/developers" locale={locale}>
                    {content.footer.docs}
                  </Link>
                </li>
                <li>
                  <a href="/docs/chatgpt-developer-mode-runbook.md">{content.footer.runbook}</a>
                </li>
              </ul>
            </div>
          </div>

          <div className="foot-bottom">
            <p>
              © {year} {content.footer.copyright}
            </p>
            <div className="credits">
              {content.footer.creditsLabel}
              {content.footer.creditLinks.map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
