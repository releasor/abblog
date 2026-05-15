export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">
        About
      </h1>

      <div className="prose prose-zinc dark:prose-invert max-w-none">
        <p>
          Welcome to KitTest — a personal blog where I share thoughts on software development,
          tools, and the craft of building things that matter.
        </p>

        <p>
          I&apos;m a developer who believes in writing clean, maintainable code and sharing
          knowledge with the community. This blog covers topics ranging from web development
          and system design to developer productivity and open source.
        </p>

        <h2>What You&apos;ll Find Here</h2>
        <ul>
          <li>Deep dives into technical topics and architecture decisions</li>
          <li>Tutorials and guides on modern web development</li>
          <li>Thoughts on developer tools and workflows</li>
          <li>Lessons learned from building real-world projects</li>
        </ul>

        <h2>Get in Touch</h2>
        <p>
          Have a question or want to collaborate? Feel free to reach out through
          any of the social links in the footer.
        </p>
      </div>
    </div>
  );
}
