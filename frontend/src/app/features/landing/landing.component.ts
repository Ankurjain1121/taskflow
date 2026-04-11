import {
  Component,
  ChangeDetectionStrategy,
  HostListener,
  signal,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChildren,
  QueryList,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- ─── Nav ────────────────────────────────────────────────── -->
    <nav
      class="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      [style.background]="scrolled() ? 'color-mix(in srgb, var(--background) 88%, transparent)' : 'transparent'"
      [style.backdrop-filter]="scrolled() ? 'blur(12px)' : 'none'"
      [style.border-bottom]="scrolled() ? '1px solid var(--border)' : '1px solid transparent'"
    >
      <div class="max-w-6xl mx-auto px-5 sm:px-8 flex items-center justify-between h-16">
        <a
          routerLink="/"
          class="text-xl font-bold tracking-tight"
          style="font-family: var(--font-display); color: var(--foreground)"
        >
          Task<span style="color: var(--primary)">Bolt</span>
        </a>
        <div class="flex items-center gap-2">
          <a
            routerLink="/auth/sign-in"
            class="px-4 py-2 text-sm font-medium transition-colors rounded-lg"
            style="font-family: var(--font-body); color: var(--muted-foreground)"
            onmouseenter="this.style.color='var(--foreground)'"
            onmouseleave="this.style.color='var(--muted-foreground)'"
          >Sign In</a>
          <a
            routerLink="/auth/sign-up"
            class="px-5 py-2 text-sm font-semibold rounded-full transition-all"
            style="
              font-family: var(--font-body);
              background: var(--primary);
              color: var(--primary-foreground);
            "
            onmouseenter="this.style.opacity='0.9'"
            onmouseleave="this.style.opacity='1'"
          >Start Free</a>
        </div>
      </div>
    </nav>

    <!-- ─── Hero ───────────────────────────────────────────────── -->
    <section
      class="pt-32 sm:pt-40 pb-8 sm:pb-12 px-5 sm:px-8"
      style="background: var(--background)"
    >
      <div class="max-w-6xl mx-auto">
        <div class="max-w-2xl mx-auto text-center">
          <p
            class="text-xs font-medium uppercase tracking-[0.2em] mb-5"
            style="font-family: var(--font-body); color: var(--muted-foreground)"
          >Project management that doesn't suck</p>

          <h1
            class="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight"
            style="font-family: var(--font-display); color: var(--foreground)"
          >Your team's work,<br>finally organized.</h1>

          <p
            class="mt-6 text-lg leading-relaxed max-w-xl mx-auto"
            style="font-family: var(--font-body); color: var(--muted-foreground)"
          >Kanban boards. Real-time collaboration. Automations that actually save time. All in one place your team will love.</p>

          <a
            routerLink="/auth/sign-up"
            class="inline-flex items-center gap-2 mt-10 px-8 py-3.5 text-base font-semibold rounded-full transition-all"
            style="
              font-family: var(--font-body);
              background: var(--primary);
              color: var(--primary-foreground);
              box-shadow: 0 4px 14px color-mix(in srgb, var(--primary) 30%, transparent);
            "
            onmouseenter="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px color-mix(in srgb, var(--primary) 40%, transparent)'"
            onmouseleave="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 14px color-mix(in srgb, var(--primary) 30%, transparent)'"
          >
            Start Free — No Credit Card
            <i class="pi pi-arrow-right text-sm"></i>
          </a>
        </div>

        <!-- Browser Chrome Mockup -->
        <div
          class="mt-16 sm:mt-20 mx-auto max-w-5xl hero-screenshot"
          [style.transform]="'perspective(1500px) rotateX(' + heroRotation() + 'deg)'"
          style="transition: transform 0.4s ease-out"
        >
          <div
            class="rounded-2xl overflow-hidden border"
            style="
              border-color: var(--border);
              box-shadow: 0 25px 80px -12px color-mix(in srgb, var(--foreground) 15%, transparent);
            "
          >
            <!-- Browser bar -->
            <div
              class="flex items-center gap-2 px-4 py-3 border-b"
              style="background: var(--card); border-color: var(--border)"
            >
              <span class="w-3 h-3 rounded-full" style="background: #EF6B6B"></span>
              <span class="w-3 h-3 rounded-full" style="background: #F4BF4F"></span>
              <span class="w-3 h-3 rounded-full" style="background: #61C554"></span>
              <span
                class="ml-3 flex-1 h-7 rounded-md"
                style="background: var(--background); max-width: 320px"
              ></span>
            </div>
            <img
              src="assets/landing/dashboard.png"
              alt="TaskBolt dashboard showing project overview, tasks, and team activity"
              class="w-full block"
              loading="eager"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- ─── Logos Bar ──────────────────────────────────────────── -->
    <section
      class="py-12 px-5 sm:px-8 border-y"
      style="background: var(--background); border-color: var(--border)"
    >
      <div class="max-w-6xl mx-auto text-center">
        <p
          class="text-xs font-medium uppercase tracking-[0.2em] mb-8"
          style="font-family: var(--font-body); color: var(--muted-foreground)"
        >Trusted by teams building the future</p>
        <div class="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          @for (company of companies; track company.name) {
            <span
              class="text-lg transition-opacity duration-200 cursor-default"
              [style.font-weight]="company.weight"
              style="font-family: var(--font-display); color: var(--foreground); opacity: 0.35"
              onmouseenter="this.style.opacity='1'"
              onmouseleave="this.style.opacity='0.35'"
            >{{ company.name }}</span>
          }
        </div>
      </div>
    </section>

    <!-- ─── Feature A: Boards (image right) ────────────────────── -->
    <section
      #animSection
      class="py-20 sm:py-28 px-5 sm:px-8 anim-section"
      style="background: var(--background)"
    >
      <div class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div>
          <p
            class="text-xs font-semibold uppercase tracking-[0.2em] mb-4"
            style="font-family: var(--font-body); color: var(--primary)"
          >Organize</p>
          <h2
            class="text-3xl sm:text-4xl font-bold leading-tight tracking-tight"
            style="font-family: var(--font-display); color: var(--foreground)"
          >Boards that adapt to how you work</h2>
          <p
            class="mt-5 text-base leading-relaxed"
            style="font-family: var(--font-body); color: var(--muted-foreground)"
          >Kanban, list, calendar, Gantt &mdash; switch views in one click. Drag tasks, set priorities, filter by anything. Your board, your rules.</p>
        </div>
        <div
          class="rounded-xl overflow-hidden border"
          style="
            border-color: var(--border);
            box-shadow: 0 16px 48px -8px color-mix(in srgb, var(--foreground) 8%, transparent);
            transform: rotate(1deg);
          "
        >
          <img
            src="assets/landing/kanban.png"
            alt="Kanban board with task cards organized by status columns"
            class="w-full block"
            loading="lazy"
          />
        </div>
      </div>
    </section>

    <!-- ─── Feature B: Collaborate (image left) ────────────────── -->
    <section
      #animSection
      class="py-20 sm:py-28 px-5 sm:px-8 anim-section"
      style="background: var(--card)"
    >
      <div class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div
          class="order-2 lg:order-1 rounded-xl overflow-hidden border"
          style="
            border-color: var(--border);
            box-shadow: 0 16px 48px -8px color-mix(in srgb, var(--foreground) 8%, transparent);
            transform: rotate(-1deg);
          "
        >
          <img
            src="assets/landing/dashboard.png"
            alt="Dashboard with real-time team activity and project metrics"
            class="w-full block"
            loading="lazy"
          />
        </div>
        <div class="order-1 lg:order-2">
          <p
            class="text-xs font-semibold uppercase tracking-[0.2em] mb-4"
            style="font-family: var(--font-body); color: var(--primary)"
          >Collaborate</p>
          <h2
            class="text-3xl sm:text-4xl font-bold leading-tight tracking-tight"
            style="font-family: var(--font-display); color: var(--foreground)"
          >Everyone on the same page. Literally.</h2>
          <p
            class="mt-5 text-base leading-relaxed"
            style="font-family: var(--font-body); color: var(--muted-foreground)"
          >Real-time updates via WebSocket. Comments, &#64;mentions, assignments. No more "did you see my Slack message about the task?"</p>
        </div>
      </div>
    </section>

    <!-- ─── Feature C: Automate (stat cards) ───────────────────── -->
    <section
      #animSection
      class="py-20 sm:py-28 px-5 sm:px-8 anim-section"
      style="background: var(--background)"
    >
      <div class="max-w-6xl mx-auto">
        <div class="text-center max-w-2xl mx-auto mb-14">
          <p
            class="text-xs font-semibold uppercase tracking-[0.2em] mb-4"
            style="font-family: var(--font-body); color: var(--primary)"
          >Automate</p>
          <h2
            class="text-3xl sm:text-4xl font-bold leading-tight tracking-tight"
            style="font-family: var(--font-display); color: var(--foreground)"
          >Stop doing what a robot could do</h2>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
          @for (stat of stats; track stat.value) {
            <div
              class="rounded-xl p-8 border text-center transition-all duration-200"
              style="
                background: var(--card);
                border-color: var(--border);
              "
              onmouseenter="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 32px -4px color-mix(in srgb, var(--foreground) 8%, transparent)'"
              onmouseleave="this.style.transform='translateY(0)';this.style.boxShadow='none'"
            >
              <p
                class="text-4xl sm:text-5xl font-bold mb-3"
                style="font-family: var(--font-display); color: var(--primary)"
              >{{ stat.value }}</p>
              <p
                class="text-sm leading-relaxed"
                style="font-family: var(--font-body); color: var(--muted-foreground)"
              >{{ stat.label }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- ─── Testimonials ───────────────────────────────────────── -->
    <section
      #animSection
      class="py-20 sm:py-28 px-5 sm:px-8 anim-section"
      style="background: var(--card)"
    >
      <div class="max-w-6xl mx-auto">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          @for (testimonial of testimonials; track testimonial.name; let i = $index) {
            <div
              class="rounded-xl p-7 border-l-4 transition-all duration-200"
              [style.margin-top]="i === 0 ? '0' : i === 1 ? '2rem' : '1rem'"
              [style.border-left-color]="'var(--primary)'"
              style="
                background: var(--background);
                box-shadow: 0 2px 12px color-mix(in srgb, var(--foreground) 4%, transparent);
              "
            >
              <span
                class="text-5xl leading-none block mb-3"
                style="color: color-mix(in srgb, var(--primary) 20%, transparent); font-family: Georgia, serif"
              >&ldquo;</span>
              <p
                class="text-sm leading-relaxed mb-6"
                style="font-family: var(--font-body); color: var(--foreground)"
              >{{ testimonial.quote }}</p>
              <div>
                <p
                  class="text-sm font-semibold"
                  style="font-family: var(--font-body); color: var(--foreground)"
                >{{ testimonial.name }}</p>
                <p
                  class="text-xs mt-0.5"
                  style="font-family: var(--font-body); color: var(--muted-foreground)"
                >{{ testimonial.role }}</p>
              </div>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- ─── Bottom CTA ─────────────────────────────────────────── -->
    <section
      class="py-20 sm:py-24 px-5 sm:px-8 relative overflow-hidden"
      style="background: var(--primary)"
    >
      <div
        class="absolute inset-0 pointer-events-none"
        style="background: radial-gradient(ellipse at center, color-mix(in srgb, var(--primary-foreground) 6%, transparent) 0%, transparent 70%)"
      ></div>
      <div class="max-w-3xl mx-auto text-center relative">
        <h2
          class="text-3xl sm:text-4xl font-bold tracking-tight"
          style="font-family: var(--font-display); color: var(--primary-foreground)"
        >Your team deserves better than spreadsheets.</h2>
        <p
          class="mt-4 text-base"
          style="font-family: var(--font-body); color: var(--primary-foreground); opacity: 0.8"
        >Free for teams up to 10. No credit card required.</p>
        <a
          routerLink="/auth/sign-up"
          class="inline-flex items-center gap-2 mt-10 px-8 py-3.5 text-base font-semibold rounded-full transition-all"
          style="
            font-family: var(--font-body);
            background: var(--primary-foreground);
            color: var(--primary);
          "
          onmouseenter="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px rgba(0,0,0,0.15)'"
          onmouseleave="this.style.transform='translateY(0)';this.style.boxShadow='none'"
        >
          Get Started Free
          <i class="pi pi-arrow-right text-sm"></i>
        </a>
      </div>
    </section>

    <!-- ─── Footer ─────────────────────────────────────────────── -->
    <footer
      class="py-14 px-5 sm:px-8 border-t"
      style="background: var(--background); border-color: var(--border)"
    >
      <div class="max-w-6xl mx-auto">
        <div class="grid grid-cols-2 md:grid-cols-3 gap-10 mb-12">
          @for (col of footerColumns; track col.title) {
            <div>
              <h3
                class="text-xs font-semibold uppercase tracking-[0.15em] mb-4"
                style="font-family: var(--font-display); color: var(--foreground)"
              >{{ col.title }}</h3>
              <ul class="space-y-2.5">
                @for (link of col.links; track link.label) {
                  <li>
                    <a
                      [routerLink]="link.href"
                      class="text-sm transition-colors"
                      style="font-family: var(--font-body); color: var(--muted-foreground)"
                      onmouseenter="this.style.color='var(--primary)'"
                      onmouseleave="this.style.color='var(--muted-foreground)'"
                    >{{ link.label }}</a>
                  </li>
                }
              </ul>
            </div>
          }
        </div>
        <div
          class="pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-3"
          style="border-color: var(--border)"
        >
          <p
            class="text-xs"
            style="font-family: var(--font-body); color: var(--muted-foreground)"
          >&copy; 2026 TaskBolt</p>
          <p
            class="text-xs"
            style="font-family: var(--font-body); color: var(--muted-foreground)"
          >Made with care for teams that ship.</p>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    :host {
      display: block;
    }

    .anim-section {
      opacity: 0;
      transform: translateY(32px);
      transition: opacity 0.7s ease-out, transform 0.7s ease-out;
    }

    .anim-section.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .hero-screenshot {
      animation: hero-float-in 1s ease-out both;
      animation-delay: 0.3s;
    }

    @keyframes hero-float-in {
      from {
        opacity: 0;
        transform: perspective(1500px) rotateX(6deg) translateY(40px);
      }
      to {
        opacity: 1;
        transform: perspective(1500px) rotateX(2deg) translateY(0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .anim-section {
        opacity: 1;
        transform: none;
        transition: none;
      }
      .hero-screenshot {
        animation: none;
      }
    }
  `],
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly scrolled = signal(false);
  readonly heroRotation = signal(2);

  @ViewChildren('animSection') animSections!: QueryList<ElementRef>;
  private observer: IntersectionObserver | null = null;

  readonly companies = [
    { name: 'Vertex', weight: 700 },
    { name: 'Nimbus AI', weight: 500 },
    { name: 'Ember Studio', weight: 600 },
    { name: 'Coastal', weight: 700 },
    { name: 'Lattice Labs', weight: 500 },
    { name: 'Oakridge', weight: 600 },
  ];

  readonly stats = [
    { value: '3 hrs/week', label: 'Average time saved per team member with workflow automations' },
    { value: 'Zero', label: 'Manual status updates needed with auto-move rules' },
    { value: '< 5 min', label: 'Time to set up your first automation from scratch' },
  ];

  readonly testimonials = [
    {
      quote: 'TaskBolt replaced three tools for our team. The kanban boards are fast, the real-time sync is seamless, and we actually enjoy using it.',
      name: 'Sarah Kim',
      role: 'Engineering Lead, Vertex',
    },
    {
      quote: 'We cut our standup time in half. Everyone can see status in real-time, so meetings are about decisions, not status updates.',
      name: 'Marcus Rivera',
      role: 'Product Manager, Nimbus AI',
    },
    {
      quote: 'The automations alone saved us 12 hours a week. We set up auto-assignment rules and never looked back.',
      name: 'Priya Desai',
      role: 'Operations Director, Coastal',
    },
  ];

  readonly footerColumns = [
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '/' },
        { label: 'Pricing', href: '/' },
        { label: 'Changelog', href: '/' },
        { label: 'Integrations', href: '/' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: '/' },
        { label: 'Blog', href: '/' },
        { label: 'Careers', href: '/' },
        { label: 'Contact', href: '/' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy', href: '/' },
        { label: 'Terms', href: '/' },
        { label: 'Security', href: '/' },
      ],
    },
  ];

  @HostListener('window:scroll')
  onScroll(): void {
    const y = window.scrollY;
    this.scrolled.set(y > 20);

    // Reduce perspective rotation as user scrolls (0 at 600px scroll)
    const rotation = Math.max(0, 2 - (y / 300));
    this.heroRotation.set(rotation);
  }

  ngOnInit(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        }
      },
      { threshold: 0.15 }
    );
  }

  ngAfterViewInit(): void {
    if (this.observer) {
      for (const section of this.animSections) {
        this.observer.observe(section.nativeElement);
      }
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
