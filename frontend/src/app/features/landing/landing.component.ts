import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- ─── Sticky Nav ─────────────────────────────────────────── -->
    <nav
      class="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b"
      style="
        background: color-mix(in srgb, var(--background) 85%, transparent);
        border-color: var(--border);
      "
    >
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
        <a
          routerLink="/"
          class="text-xl font-bold tracking-tight"
          style="font-family: var(--font-display); color: var(--foreground)"
        >
          Task<span style="color: var(--primary)">Bolt</span>
        </a>

        <div class="flex items-center gap-3">
          <a
            routerLink="/auth/sign-in"
            class="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style="
              font-family: var(--font-body);
              color: var(--foreground);
            "
            onmouseenter="this.style.background='var(--accent)'"
            onmouseleave="this.style.background='transparent'"
          >
            Sign In
          </a>
          <a
            routerLink="/auth/sign-up"
            class="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style="
              font-family: var(--font-body);
              background: var(--primary);
              color: var(--primary-foreground);
            "
            onmouseenter="this.style.opacity='0.9'"
            onmouseleave="this.style.opacity='1'"
          >
            Get Started
          </a>
        </div>
      </div>
    </nav>

    <!-- ─── Hero Section ───────────────────────────────────────── -->
    <section
      class="pt-28 pb-16 sm:pt-36 sm:pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
      style="background: var(--background)"
    >
      <!-- Decorative shapes -->
      <div class="absolute top-16 right-0 w-[420px] h-[420px] opacity-[0.07] pointer-events-none hidden lg:block">
        <div
          class="absolute top-0 right-0 w-72 h-72 rounded-3xl rotate-12"
          style="background: var(--primary)"
        ></div>
        <div
          class="absolute top-20 right-20 w-56 h-56 rounded-3xl -rotate-6"
          style="background: var(--accent-warm)"
        ></div>
        <div
          class="absolute top-10 right-40 w-40 h-40 rounded-full rotate-3"
          style="background: var(--success)"
        ></div>
      </div>

      <div class="max-w-7xl mx-auto relative">
        <div class="max-w-3xl">
          <h1
            class="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight"
            style="font-family: var(--font-display); color: var(--foreground)"
          >
            Manage projects with
            <span style="color: var(--primary)">clarity</span>,
            not chaos
          </h1>
          <p
            class="mt-6 text-lg sm:text-xl leading-relaxed max-w-2xl"
            style="font-family: var(--font-body); color: var(--muted-foreground)"
          >
            TaskBolt brings your team's work together &mdash; kanban boards,
            reports, automations, and real-time collaboration.
          </p>

          <div class="mt-10 flex flex-wrap items-center gap-4">
            <a
              routerLink="/auth/sign-up"
              class="inline-flex items-center px-7 py-3.5 text-base font-semibold rounded-xl transition-all"
              style="
                font-family: var(--font-body);
                background: var(--primary);
                color: var(--primary-foreground);
                box-shadow: var(--shadow-md);
              "
              onmouseenter="this.style.transform='translateY(-1px)';this.style.boxShadow='var(--shadow-lg)'"
              onmouseleave="this.style.transform='translateY(0)';this.style.boxShadow='var(--shadow-md)'"
            >
              Get Started Free
              <i class="pi pi-arrow-right ml-2 text-sm"></i>
            </a>
            <a
              href="#features"
              class="inline-flex items-center px-7 py-3.5 text-base font-semibold rounded-xl border transition-all"
              style="
                font-family: var(--font-body);
                color: var(--foreground);
                border-color: var(--border);
                background: transparent;
              "
              onmouseenter="this.style.background='var(--accent)';this.style.borderColor='var(--primary)'"
              onmouseleave="this.style.background='transparent';this.style.borderColor='var(--border)'"
              (click)="scrollToFeatures($event)"
            >
              See How It Works
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- ─── Social Proof Bar ───────────────────────────────────── -->
    <section
      class="py-10 px-4 sm:px-6 lg:px-8 border-y"
      style="background: var(--card); border-color: var(--border)"
    >
      <div class="max-w-7xl mx-auto text-center">
        <p
          class="text-sm font-medium uppercase tracking-widest mb-6"
          style="font-family: var(--font-body); color: var(--muted-foreground)"
        >
          Trusted by teams at
        </p>
        <div class="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          @for (company of companies; track company) {
            <span
              class="text-lg font-semibold opacity-40"
              style="font-family: var(--font-display); color: var(--foreground)"
            >
              {{ company }}
            </span>
          }
        </div>
      </div>
    </section>

    <!-- ─── Features Section ───────────────────────────────────── -->
    <section
      id="features"
      class="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 scroll-mt-20"
      style="background: var(--background)"
    >
      <div class="max-w-7xl mx-auto">
        <div class="text-center mb-14">
          <h2
            class="text-3xl sm:text-4xl font-bold tracking-tight"
            style="font-family: var(--font-display); color: var(--foreground)"
          >
            Everything your team needs
          </h2>
          <p
            class="mt-4 text-lg max-w-2xl mx-auto"
            style="font-family: var(--font-body); color: var(--muted-foreground)"
          >
            From planning to delivery, TaskBolt keeps everyone aligned and moving forward.
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (feature of features; track feature.title) {
            <div
              class="rounded-xl p-6 border transition-all"
              style="
                background: var(--card);
                border-color: var(--border);
                box-shadow: var(--shadow-sm);
              "
              onmouseenter="this.style.boxShadow='var(--shadow-md)';this.style.transform='translateY(-2px)'"
              onmouseleave="this.style.boxShadow='var(--shadow-sm)';this.style.transform='translateY(0)'"
            >
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                style="background: var(--accent)"
              >
                <i
                  class="{{ feature.icon }} text-lg"
                  style="color: var(--primary)"
                ></i>
              </div>
              <h3
                class="text-lg font-semibold mb-2"
                style="font-family: var(--font-display); color: var(--foreground)"
              >
                {{ feature.title }}
              </h3>
              <p
                class="text-sm leading-relaxed"
                style="font-family: var(--font-body); color: var(--muted-foreground)"
              >
                {{ feature.description }}
              </p>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- ─── How It Works ───────────────────────────────────────── -->
    <section
      id="how-it-works"
      class="py-16 sm:py-24 px-4 sm:px-6 lg:px-8"
      style="background: var(--card)"
    >
      <div class="max-w-7xl mx-auto">
        <div class="text-center mb-14">
          <h2
            class="text-3xl sm:text-4xl font-bold tracking-tight"
            style="font-family: var(--font-display); color: var(--foreground)"
          >
            Up and running in minutes
          </h2>
          <p
            class="mt-4 text-lg max-w-2xl mx-auto"
            style="font-family: var(--font-body); color: var(--muted-foreground)"
          >
            Three steps to organized, stress-free project management.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <!-- Connecting line (desktop) -->
          <div
            class="hidden md:block absolute top-8 left-[16.6%] right-[16.6%] h-0.5"
            style="background: var(--border)"
          ></div>

          @for (step of steps; track step.number) {
            <div class="text-center relative">
              <div
                class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 text-xl font-bold relative z-10"
                style="
                  font-family: var(--font-display);
                  background: var(--primary);
                  color: var(--primary-foreground);
                  box-shadow: var(--shadow-md);
                "
              >
                {{ step.number }}
              </div>
              <h3
                class="text-lg font-semibold mb-2"
                style="font-family: var(--font-display); color: var(--foreground)"
              >
                {{ step.title }}
              </h3>
              <p
                class="text-sm leading-relaxed max-w-xs mx-auto"
                style="font-family: var(--font-body); color: var(--muted-foreground)"
              >
                {{ step.description }}
              </p>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- ─── Testimonials ───────────────────────────────────────── -->
    <section
      class="py-16 sm:py-24 px-4 sm:px-6 lg:px-8"
      style="background: var(--background)"
    >
      <div class="max-w-7xl mx-auto">
        <div class="text-center mb-14">
          <h2
            class="text-3xl sm:text-4xl font-bold tracking-tight"
            style="font-family: var(--font-display); color: var(--foreground)"
          >
            Loved by teams everywhere
          </h2>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          @for (testimonial of testimonials; track testimonial.name) {
            <div
              class="rounded-xl p-6 border"
              style="
                background: var(--card);
                border-color: var(--border);
                box-shadow: var(--shadow-sm);
              "
            >
              <div class="flex items-center gap-1 mb-4">
                @for (star of [1, 2, 3, 4, 5]; track star) {
                  <i
                    class="pi pi-star-fill text-sm"
                    style="color: var(--accent-warm)"
                  ></i>
                }
              </div>
              <p
                class="text-sm leading-relaxed mb-5"
                style="font-family: var(--font-body); color: var(--foreground)"
              >
                &ldquo;{{ testimonial.quote }}&rdquo;
              </p>
              <div class="flex items-center gap-3">
                <div
                  class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold"
                  style="
                    background: var(--accent);
                    color: var(--primary);
                    font-family: var(--font-display);
                  "
                >
                  {{ testimonial.initials }}
                </div>
                <div>
                  <p
                    class="text-sm font-medium"
                    style="font-family: var(--font-body); color: var(--foreground)"
                  >
                    {{ testimonial.name }}
                  </p>
                  <p
                    class="text-xs"
                    style="font-family: var(--font-body); color: var(--muted-foreground)"
                  >
                    {{ testimonial.role }}
                  </p>
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- ─── CTA Banner ─────────────────────────────────────────── -->
    <section
      class="py-16 sm:py-20 px-4 sm:px-6 lg:px-8"
      style="background: var(--primary)"
    >
      <div class="max-w-3xl mx-auto text-center">
        <h2
          class="text-3xl sm:text-4xl font-bold tracking-tight"
          style="font-family: var(--font-display); color: var(--primary-foreground)"
        >
          Ready to streamline your workflow?
        </h2>
        <p
          class="mt-4 text-base opacity-90"
          style="font-family: var(--font-body); color: var(--primary-foreground)"
        >
          Join teams who ship faster with TaskBolt.
        </p>
        <div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            routerLink="/auth/sign-up"
            class="inline-flex items-center px-8 py-3.5 text-base font-semibold rounded-xl transition-all"
            style="
              font-family: var(--font-body);
              background: var(--primary-foreground);
              color: var(--primary);
              box-shadow: var(--shadow-md);
            "
            onmouseenter="this.style.transform='translateY(-1px)';this.style.boxShadow='var(--shadow-lg)'"
            onmouseleave="this.style.transform='translateY(0)';this.style.boxShadow='var(--shadow-md)'"
          >
            Get Started Free
            <i class="pi pi-arrow-right ml-2 text-sm"></i>
          </a>
        </div>
        <p
          class="mt-4 text-sm opacity-75"
          style="font-family: var(--font-body); color: var(--primary-foreground)"
        >
          No credit card required
        </p>
      </div>
    </section>

    <!-- ─── Footer ─────────────────────────────────────────────── -->
    <footer
      class="py-14 px-4 sm:px-6 lg:px-8 border-t"
      style="background: var(--card); border-color: var(--border)"
    >
      <div class="max-w-7xl mx-auto">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          @for (col of footerColumns; track col.title) {
            <div>
              <h4
                class="text-sm font-semibold uppercase tracking-wider mb-4"
                style="font-family: var(--font-display); color: var(--foreground)"
              >
                {{ col.title }}
              </h4>
              <ul class="space-y-2.5">
                @for (link of col.links; track link.label) {
                  <li>
                    <a
                      [routerLink]="link.href"
                      class="text-sm transition-colors"
                      style="font-family: var(--font-body); color: var(--muted-foreground)"
                      onmouseenter="this.style.color='var(--primary)'"
                      onmouseleave="this.style.color='var(--muted-foreground)'"
                    >
                      {{ link.label }}
                    </a>
                  </li>
                }
              </ul>
            </div>
          }
        </div>

        <div
          class="pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4"
          style="border-color: var(--border)"
        >
          <p
            class="text-sm"
            style="font-family: var(--font-body); color: var(--muted-foreground)"
          >
            &copy; {{ currentYear }} TaskBolt. All rights reserved.
          </p>
          <a
            routerLink="/"
            class="text-lg font-bold tracking-tight"
            style="font-family: var(--font-display); color: var(--foreground)"
          >
            Task<span style="color: var(--primary)">Bolt</span>
          </a>
        </div>
      </div>
    </footer>
  `,
})
export class LandingComponent {
  readonly currentYear = new Date().getFullYear();

  readonly companies = [
    'Acme Corp',
    'Vertex Labs',
    'Nimbus',
    'Ember Studio',
    'Coastal Dev',
  ];

  readonly features = [
    {
      icon: 'pi pi-objects-column',
      title: 'Kanban Boards',
      description:
        'Drag-and-drop task management with customizable columns.',
    },
    {
      icon: 'pi pi-chart-bar',
      title: 'Reports & Analytics',
      description:
        'Burndown charts, velocity reports, and workload insights.',
    },
    {
      icon: 'pi pi-bolt',
      title: 'Automations',
      description:
        'When X happens, do Y \u2014 eliminate repetitive manual work.',
    },
    {
      icon: 'pi pi-users',
      title: 'Team Collaboration',
      description:
        'Assign tasks, comment, and track who\u2019s doing what.',
    },
    {
      icon: 'pi pi-calendar',
      title: 'Calendar View',
      description:
        'See deadlines and milestones on a visual timeline.',
    },
    {
      icon: 'pi pi-clock',
      title: 'Time Tracking',
      description:
        'Log time with start/stop timers or manual entries.',
    },
  ];

  readonly steps = [
    {
      number: 1,
      title: 'Create a workspace',
      description: 'Set up your team\u2019s home base in seconds.',
    },
    {
      number: 2,
      title: 'Add projects & tasks',
      description:
        'Organize work your way \u2014 kanban, list, or calendar.',
    },
    {
      number: 3,
      title: 'Collaborate & deliver',
      description:
        'Track progress, automate workflows, hit deadlines.',
    },
  ];

  readonly testimonials = [
    {
      quote:
        'TaskBolt replaced three tools for our team. The kanban boards are incredibly intuitive.',
      name: 'Sarah K.',
      role: 'Engineering Lead',
      initials: 'SK',
    },
    {
      quote:
        'We cut our meeting time in half because everyone can see task status in real-time.',
      name: 'Marcus R.',
      role: 'Product Manager',
      initials: 'MR',
    },
    {
      quote:
        'The automations save us hours every week. Set it and forget it.',
      name: 'Priya D.',
      role: 'Operations Director',
      initials: 'PD',
    },
  ];

  readonly footerColumns = [
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '/' },
        { label: 'Pricing', href: '/' },
        { label: 'Integrations', href: '/' },
        { label: 'Changelog', href: '/' },
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
      title: 'Resources',
      links: [
        { label: 'Help Center', href: '/help' },
        { label: 'API Docs', href: '/' },
        { label: 'Templates', href: '/' },
        { label: 'Community', href: '/' },
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

  scrollToFeatures(event: Event): void {
    event.preventDefault();
    const el = document.getElementById('features');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
