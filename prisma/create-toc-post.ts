import { PrismaClient } from "../generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const url = process.env.DATABASE_URL!;
const adapter = new PrismaMariaDb(url);
const prisma = new PrismaClient({ adapter });

async function main() {
  const content = `<h2>Introduction to Modern Web Development</h2>
<p>Web development has evolved significantly over the past decade. From simple static HTML pages to complex single-page applications, the landscape has changed dramatically. In this comprehensive guide, we'll explore the key concepts and technologies that define modern web development.</p>
<p>The rise of JavaScript frameworks, the adoption of TypeScript, and the emergence of server-side rendering solutions have all contributed to a richer ecosystem. Developers now have more tools than ever to build fast, accessible, and maintainable web applications.</p>
<p>Understanding the fundamentals is crucial before diving into any framework. HTML, CSS, and JavaScript remain the core building blocks of every web application. However, the way we use these technologies has evolved significantly.</p>

<h3>Why TypeScript Matters</h3>
<p>TypeScript has become the de facto standard for large-scale JavaScript applications. Its static type system catches errors at compile time rather than runtime, making code more reliable and easier to refactor. The developer experience improvements are substantial.</p>
<p>With TypeScript, you get better IDE support, including autocompletion, type checking, and refactoring tools. This leads to faster development cycles and fewer bugs in production. Many major frameworks now use TypeScript by default.</p>
<p>The learning curve for TypeScript is relatively gentle for developers already familiar with JavaScript. The type annotations are optional, so you can adopt them gradually. This makes migration from JavaScript to TypeScript straightforward.</p>

<h3>Choosing the Right Framework</h3>
<p>The choice of framework depends on your project requirements, team expertise, and long-term maintenance considerations. React, Vue, and Angular each have their strengths and trade-offs. Understanding these differences is key to making the right decision.</p>
<p>React offers the largest ecosystem and community support. Its component-based architecture and virtual DOM make it excellent for building complex user interfaces. The learning curve is moderate, and the documentation is comprehensive.</p>
<p>Vue provides a more approachable learning curve with excellent documentation. Its reactivity system and single-file components make it a favorite among developers who value simplicity. The ecosystem is growing rapidly.</p>

<h2>Setting Up Your Development Environment</h2>
<p>A well-configured development environment is essential for productivity. This includes your code editor, version control system, package manager, and build tools. Taking the time to set up these tools properly will save you hours of frustration later.</p>
<p>VS Code has become the most popular code editor for web development. Its extensive extension library, integrated terminal, and built-in Git support make it a powerful tool. Extensions like ESLint, Prettier, and GitLens enhance the development experience.</p>
<p>Node.js and npm (or pnpm/yarn) are required for most modern web projects. They handle dependency management, script running, and build processes. Understanding how to use these tools effectively is fundamental to web development.</p>

<h3>Editor Configuration</h3>
<p>Configuring your editor properly can significantly improve your coding speed and reduce errors. ESLint helps catch code quality issues, while Prettier ensures consistent formatting across your codebase. These tools work together to maintain code standards.</p>
<p>EditorConfig files help maintain consistent coding styles across different editors and IDEs. They define settings like indent style, charset, and line endings. This is especially important when working in teams with different editor preferences.</p>
<p>Setting up keyboard shortcuts and snippets can also boost your productivity. Most editors allow you to create custom snippets for frequently used code patterns. This reduces typing and helps maintain consistency.</p>

<h3>Version Control with Git</h3>
<p>Git is an essential tool for any development project. It tracks changes, enables collaboration, and provides a safety net for experimentation. Understanding Git workflows is crucial for team-based development.</p>
<p>Branching strategies like Git Flow or trunk-based development help organize work and manage releases. Pull requests and code reviews ensure code quality and knowledge sharing among team members.</p>
<p>Commit messages should be clear and descriptive. They explain what changed and why, making it easier to understand the project history. Tools like commitlint can help enforce consistent commit message formats.</p>

<h2>Building Responsive Layouts</h2>
<p>Responsive design ensures your application works well on all screen sizes, from mobile phones to large desktop monitors. CSS Flexbox and Grid have revolutionized how we build layouts, making responsive design more intuitive and maintainable.</p>
<p>Mobile-first design is a best practice that starts with the smallest screen size and progressively enhances the layout for larger screens. This approach ensures a good experience on mobile devices, which now account for the majority of web traffic.</p>
<p>Testing on real devices is important, but browser developer tools provide excellent responsive design testing capabilities. The device emulation feature allows you to test various screen sizes and orientations quickly.</p>

<h3>CSS Grid for Complex Layouts</h3>
<p>CSS Grid is a powerful two-dimensional layout system that makes complex layouts straightforward. It allows you to define rows and columns explicitly, creating layouts that were previously difficult to achieve with CSS alone.</p>
<p>Grid template areas provide a visual way to define layouts. You can name grid areas and assign elements to them, making the layout code more readable and maintainable. This is especially useful for page-level layouts.</p>
<p>Subgrid, a newer feature, allows nested grids to align with their parent grid. This solves many common layout challenges and reduces the need for workarounds. Browser support is growing rapidly.</p>

<h3>Flexbox for Component Layouts</h3>
<p>Flexbox excels at one-dimensional layouts, handling either rows or columns. It's perfect for component-level layouts like navigation bars, card grids, and form layouts. The alignment and distribution properties make it easy to center and space elements.</p>
<p>The flex shorthand property combines flex-grow, flex-shrink, and flex-basis into a single declaration. Understanding these properties is key to creating flexible layouts that adapt to different content sizes.</p>
<p>Gap properties (row-gap and column-gap) simplify spacing between flex items. They eliminate the need for margin hacks and create consistent spacing throughout your layout.</p>

<h2>State Management Strategies</h2>
<p>Managing state effectively is one of the most challenging aspects of frontend development. As applications grow in complexity, the need for a clear state management strategy becomes critical. Poor state management leads to bugs, performance issues, and difficult maintenance.</p>
<p>The choice of state management approach depends on your application's complexity and requirements. Simple applications might only need component-local state, while complex applications might benefit from a global state management solution.</p>
<p>Understanding when to use local state versus global state is crucial. Not every piece of data needs to be global. Keeping state as close as possible to where it's used improves performance and makes code easier to understand.</p>

<h3>Local Component State</h3>
<p>React's useState hook provides a simple way to manage state within a component. It's perfect for UI state like form inputs, toggles, and modals. The state is scoped to the component and doesn't affect other parts of the application.</p>
<p>useReducer is an alternative to useState for more complex state logic. It uses a reducer function to handle state transitions, making it easier to manage related state changes. This pattern is similar to Redux but scoped to a single component.</p>
<p>Derived state should be computed from existing state rather than stored separately. This prevents state synchronization issues and ensures your data is always consistent. useMemo can optimize expensive computations.</p>

<h3>Global State with Context</h3>
<p>React Context provides a way to share state across the component tree without prop drilling. It's ideal for theme settings, user authentication, and locale preferences. However, it's not optimized for frequently changing values.</p>
<p>The useContext hook consumes context values in functional components. Combined with useReducer, it can create a lightweight state management solution for medium-complexity applications. This avoids the overhead of external libraries.</p>
<p>Performance can be an issue with Context when values change frequently, as all consumers re-render. Splitting contexts by update frequency or using memoization techniques can mitigate this problem.</p>

<h2>Performance Optimization</h2>
<p>Performance is a critical aspect of user experience. Slow-loading pages and unresponsive interfaces drive users away. Understanding and applying performance optimization techniques is essential for building successful web applications.</p>
<p>Core Web Vitals (LCP, FID, CLS) are Google's metrics for measuring user experience. Optimizing these metrics improves both user satisfaction and search engine rankings. Tools like Lighthouse and PageSpeed Insights help identify performance bottlenecks.</p>
<p>Bundle size directly affects load time. Code splitting, tree shaking, and lazy loading help reduce the initial bundle size. Dynamic imports allow you to load code on demand, improving initial page load performance.</p>

<h3>Code Splitting Techniques</h3>
<p>Code splitting breaks your application into smaller chunks that are loaded on demand. This significantly reduces the initial load time, as users only download the code they need for the current page. React.lazy and Suspense make code splitting straightforward.</p>
<p>Route-based code splitting is the most common approach. Each route loads its own chunk, so navigating to a new page only downloads the necessary code. This is especially effective for applications with many routes.</p>
<p>Component-based code splitting loads heavy components only when they're needed. This is useful for modals, charts, and other components that aren't visible on initial page load. The loading state should be handled gracefully.</p>

<h3>Image Optimization</h3>
<p>Images often account for the majority of a page's total size. Optimizing images through compression, modern formats (WebP, AVIF), and responsive sizing can dramatically improve load times. Next.js provides built-in image optimization.</p>
<p>Lazy loading defers image loading until they're about to enter the viewport. This reduces initial page load time and saves bandwidth for users who don't scroll to all images. The loading="lazy" attribute provides native lazy loading.</p>
<p>Responsive images serve different image sizes based on the user's device and screen size. The srcset and sizes attributes allow browsers to choose the most appropriate image, reducing bandwidth usage on mobile devices.</p>

<h2>Testing Your Application</h2>
<p>Testing is essential for maintaining code quality and preventing regressions. A well-tested codebase gives developers confidence to make changes and refactor without fear of breaking existing functionality. Different types of tests serve different purposes.</p>
<p>Unit tests verify individual functions and components in isolation. They're fast to run and easy to maintain. Integration tests verify that different parts of the application work together correctly. End-to-end tests simulate real user interactions.</p>
<p>Test-driven development (TDD) is a methodology where tests are written before the implementation code. This ensures that code is testable and that all features have test coverage. It also helps clarify requirements before implementation begins.</p>

<h3>Unit Testing with Jest</h3>
<p>Jest is the most popular testing framework for JavaScript applications. It provides a test runner, assertion library, and mocking capabilities out of the box. Its snapshot testing feature is particularly useful for React components.</p>
<p>Writing good unit tests requires understanding what to test and what to mock. Focus on testing behavior rather than implementation details. Mock external dependencies to isolate the unit under test.</p>
<p>Code coverage reports help identify untested code paths. While 100% coverage isn't always necessary or practical, aiming for high coverage on critical business logic ensures key functionality is well-tested.</p>

<h3>Integration Testing</h3>
<p>Integration tests verify that different modules work together correctly. They catch issues that unit tests miss, such as incorrect API contracts or data transformation errors. React Testing Library is excellent for testing component integration.</p>
<p>Testing user interactions (clicks, form submissions, navigation) ensures the application behaves correctly from the user's perspective. These tests provide high confidence that the application works as expected.</p>
<p>Mocking API calls in integration tests allows you to test different scenarios (success, error, loading states) without relying on a running backend. MSW (Mock Service Worker) is a popular tool for this purpose.</p>

<h2>Conclusion</h2>
<p>Modern web development is a rich and evolving field. By understanding the fundamentals and staying current with new developments, you can build applications that are fast, accessible, and maintainable. The key is to start with solid foundations and progressively adopt new tools and techniques as needed.</p>
<p>Remember that technology choices should be driven by project requirements, not hype. The best framework or tool is the one that solves your specific problem effectively. Keep learning, keep experimenting, and most importantly, keep building.</p>`;

  // Check if post already exists
  const existing = await prisma.post.findUnique({ where: { slug: "complete-guide-modern-web-dev" } });
  if (existing) {
    console.log("Post already exists, updating content...");
    await prisma.post.update({
      where: { slug: "complete-guide-modern-web-dev" },
      data: { content, status: "PUBLISHED", publishedAt: new Date() },
    });
  } else {
    const admin = await prisma.adminUser.findUnique({ where: { email: "admin@blog.com" } });
    if (!admin) throw new Error("Admin user not found");

    await prisma.post.create({
      data: {
        title: "Complete Guide to Modern Web Development",
        slug: "complete-guide-modern-web-dev",
        content,
        excerpt: "A comprehensive guide covering TypeScript, responsive layouts, state management, performance optimization, and testing strategies for modern web applications.",
        status: "PUBLISHED",
        publishedAt: new Date(),
        authorId: admin.id,
        categoryId: 2, // Programming
      },
    });
  }

  console.log("Post created/updated successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
