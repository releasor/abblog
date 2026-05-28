import { websiteSchema, organizationSchema, articleSchema, faqSchema } from "../structured-data";

describe("websiteSchema", () => {
  it("returns valid WebSite schema", () => {
    const schema = websiteSchema();
    expect(schema["@type"]).toBe("WebSite");
    expect(schema.name).toBe("billionaire");
    expect(schema.url).toBeTruthy();
    expect(schema.potentialAction["@type"]).toBe("SearchAction");
  });
});

describe("organizationSchema", () => {
  it("returns valid Organization schema", () => {
    const schema = organizationSchema();
    expect(schema["@type"]).toBe("Organization");
    expect(schema.name).toBe("billionaire");
    expect(schema.url).toBeTruthy();
  });
});

describe("articleSchema", () => {
  it("returns valid Article schema with all fields", () => {
    const post = {
      title: "Test Post",
      excerpt: "A test excerpt",
      coverImageUrl: "https://example.com/image.jpg",
      publishedAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-02"),
      slug: "test-post",
      author: { name: "Author" },
    };
    const schema = articleSchema(post);
    expect(schema["@type"]).toBe("Article");
    expect(schema.headline).toBe("Test Post");
    expect(schema.description).toBe("A test excerpt");
    expect(schema.image).toBe("https://example.com/image.jpg");
    expect(schema.author.name).toBe("Author");
    expect(schema.mainEntityOfPage["@id"]).toContain("/posts/test-post");
  });

  it("handles optional fields", () => {
    const post = {
      title: "Minimal Post",
      slug: "minimal",
      author: { name: "Author" },
    };
    const schema = articleSchema(post);
    expect(schema["@type"]).toBe("Article");
    expect(schema.headline).toBe("Minimal Post");
    expect(schema.description).toBeUndefined();
    expect(schema.image).toBeUndefined();
  });
});

describe("faqSchema", () => {
  it("returns valid FAQPage schema", () => {
    const questions = [
      { question: "What is this?", answer: "A blog." },
      { question: "How to use?", answer: "Read and enjoy." },
    ];
    const schema = faqSchema(questions);
    expect(schema["@type"]).toBe("FAQPage");
    expect(schema.mainEntity).toHaveLength(2);
    expect(schema.mainEntity[0]["@type"]).toBe("Question");
    expect(schema.mainEntity[0].name).toBe("What is this?");
    expect(schema.mainEntity[0].acceptedAnswer.text).toBe("A blog.");
  });

  it("handles empty questions array", () => {
    const schema = faqSchema([]);
    expect(schema.mainEntity).toHaveLength(0);
  });
});
