import { websiteSchema, organizationSchema } from "../structured-data";

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
