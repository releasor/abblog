-- CreateFullTextIndex
CREATE FULLTEXT INDEX idx_posts_title_content ON posts(title, content);
