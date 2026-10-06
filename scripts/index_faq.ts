import { faqCatalog } from "../src/faq_catalog.js";
import { indexFaqEntries } from "../src/infrai_faq_index.js";

const indexed = await indexFaqEntries(faqCatalog);
console.log(indexed
  ? `Indexed ${faqCatalog.length} developer FAQ entries.`
  : `Validated embeddings for ${faqCatalog.length} developer FAQ entries; no persistent collection was changed.`);
