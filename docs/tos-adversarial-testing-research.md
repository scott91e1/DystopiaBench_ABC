# ToS & Acceptable Use Policy Research: Adversarial / Red-Team / Benchmark Testing

**Date:** 2026-04-07
**Scope:** 10 LLM providers + OpenRouter (aggregator)
**Purpose:** Determine legal/policy risk surface for DystopiaBench guardrail evaluation across providers

---

## Executive Summary

Running adversarial safety benchmarks against LLM APIs carries real legal and account risk. The landscape breaks into three tiers:

| Tier | Providers | Risk Level |
|------|-----------|------------|
| **Safest** (formal programs exist) | Anthropic, OpenAI, Google | LOW if you apply to their programs |
| **Middling** (ToS prohibits, but open-weight escape hatch exists) | Mistral, DeepSeek, Qwen/Alibaba, Zhipu/Z.ai | MEDIUM via API; ZERO if self-hosted |
| **Restrictive / Opaque** (no clear program, ToS prohibits) | xAI/Grok, Moonshot/Kimi, MiniMax | HIGH via API |

**Critical finding:** OpenRouter does NOT shield you from upstream provider bans. You MUST get OpenRouter's written approval first, AND that approval still may not protect against individual provider enforcement.

---

## 1. Anthropic (Claude)

### 1.1 Is red-teaming/safety benchmarking explicitly allowed?
**YES, with authorization.** Anthropic runs a formal Model Safety Bug Bounty Program via HackerOne, actively paying researchers up to $15,000 per finding for novel universal jailbreaks, especially in CBRN and cybersecurity domains. They also run Policy Vulnerability Testing (PVT) with external subject-matter experts.

### 1.2 What's explicitly banned?
- Weapons of mass destruction content (CBRN)
- Child sexual exploitation material
- Hate speech / protected-class discrimination
- Sexually explicit content generation
- Malicious cyber operations
- Disinformation campaigns / election manipulation
- Biometric discrimination (inferring race/religion from biometric data)
- Conspiracy theory promotion
- Circumventing safety measures without authorization

### 1.3 Research/academic exception?
**YES.** The External Researcher Access Program provides free API credits for AI safety and alignment research. However, participants are NOT exempt from the Usage Policy by default. Two paths exist:
- Close collaborators of Anthropic employees can request internal approval for specific exemptions
- The Model Safety Bug Bounty Program covers jailbreak-focused research specifically

The Anthropic Fellows Program funds engineers/researchers on adversarial robustness, AI control, interpretability, and AI security.

### 1.4 Responsible disclosure / bug bounty?
**YES.**
- HackerOne VDP: https://hackerone.com/anthropic-vdp
- Model Safety Bug Bounty: up to $15,000/finding
- Email: usersafety@anthropic.com (safety issues), disclosure@anthropic.com (policy questions)
- Safe harbor: Anthropic will not pursue legal action for good-faith research under their policy
- Response SLA: 3 business days acknowledgment
- Public reporting portal: https://red.anthropic.com

### 1.5 Violation consequences?
**Graduated.** Warnings exist but Anthropic banned 1.45 million accounts in H2 2025 (52,000 appeals, only 1,700 overturned -- 3.3% success rate). Can terminate without notice for ToS violations. No refund for paid subscriptions on termination.

### 1.6 Ban scope?
**Account-wide.** Affects Claude.ai, Console/API, and Claude Code. OAuth tokens from subscriptions are blocked from non-official clients. The ban covers the entire Anthropic ecosystem but does NOT extend to other companies' services.

---

## 2. OpenAI (GPT)

### 2.1 Is red-teaming/safety benchmarking explicitly allowed?
**YES, through formal programs.** OpenAI runs:
- Red Teaming Network (NDA-based, external domain experts)
- Security Bug Bounty (up to $100,000 for exceptional findings as of 2025)
- Safety Bug Bounty (for abuse/safety risks that aren't traditional security vulns)
- Specialized Bio Bug Bounty programs (GPT-5, agent bio -- invite-only)
- Partnership with SpecterOps for adversarial infrastructure testing

**Unauthorized** red-teaming is prohibited: "circumventing any rate limits or restrictions or bypassing any protective measures or safety mitigations" is explicitly banned.

### 2.2 What's explicitly banned?
- Illegal, harmful, or abusive activity
- Circumventing safety mitigations or rate limits
- Representing AI output as human-generated (in contexts requiring disclosure)
- Surveillance and influence campaigns
- Malware development
- Updated 2025-10-29: universal policies across all OpenAI products

### 2.3 Research/academic exception?
**Yes, via application.** The Red Teaming Network and Safety Bug Bounty are open to external researchers by application. Academic use is permitted within general Usage Policy bounds. No blanket academic exemption.

### 2.4 Responsible disclosure / bug bounty?
**YES.**
- HackerOne: https://hackerone.com/open-ai
- Security Bug Bounty: up to $100,000 (increased from $20,000 in 2025)
- Safety Bug Bounty: separate program for abuse/safety risks
- Coordinated Vulnerability Disclosure Policy: https://openai.com/policies/coordinated-vulnerability-disclosure-policy/
- Specialized programs: GPT-5 Bio Bug Bounty, Agent Bio Bug Bounty

### 2.5 Violation consequences?
**Can be immediate.** OpenAI may "limit or suspend a customer's access" for (a) legal requirements, (b) policy violations, or (c) Security Emergencies. "Reasonable efforts" to notify before suspension, but no guarantee of prior notice. Appeal available via Support.

### 2.6 Ban scope?
**Likely all OpenAI services.** Universal usage policies apply across all OpenAI products (ChatGPT, API, DALL-E, etc.). Bans may extend to IP address and payment method, though exact cross-service mechanics are not explicitly documented. A single violation can affect your entire OpenAI relationship.

---

## 3. Google (Gemini)

### 3.1 Is red-teaming/safety benchmarking explicitly allowed?
**YES, internally and through structured programs.** Google's Content Adversarial Red Team (CART) completed 350+ exercises in 2025. External assessments by Apollo Research, Vaultis, and Dreadnode. Google encourages adversarial testing as part of application development -- but only of YOUR OWN applications built on Gemini, not of Gemini itself.

### 3.2 What's explicitly banned?
Per the Generative AI Prohibited Use Policy:
- Child sexual abuse / exploitation
- Violent extremism / terrorism
- Non-consensual intimate imagery
- Self-harm facilitation
- Sexually explicit content
- Hate speech
- Harassment / bullying
- Circumventing safety mechanisms of Google AI products

### 3.3 Research/academic exception?
**Limited.** The AI Vulnerability Reward Program (VRP) covers security vulnerabilities but EXPLICITLY EXCLUDES: prompt injection, jailbreaks, and alignment issues. These are out-of-scope for rewards. No formal academic exemption for adversarial safety testing of Gemini itself.

### 3.4 Responsible disclosure / bug bounty?
**YES.**
- AI Vulnerability Reward Program: up to $30,000/finding
- Portal: https://bughunters.google.com
- $430,000+ paid for AI-product vulnerabilities since launch
- EXCLUDES: prompt injection, jailbreaks, alignment issues (these don't qualify)
- In-scope: account takeover via AI, architecture/model extraction, exploits affecting users

### 3.5 Violation consequences?
**Graduated but severe.** Three tiers:
1. Limit access to Gemini API
2. Temporarily pause access
3. **Permanently close access to Gemini API AND other Google services**

### 3.6 Ban scope?
**CRITICAL: Cross-service.** This is the most dangerous provider. A Gemini API policy violation can cascade to:
- Google Cloud Platform (all services disabled)
- Gmail, Drive, Google Workspace
- YouTube, Google Play
- Your entire Google Account

Real incidents documented: users lost Google Cloud access entirely after Gemini API policy violations. This is confirmed in forum reports and Google's own enforcement documentation. A Gemini ban can effectively lock you out of the entire Google ecosystem.

---

## 4. xAI (Grok)

### 4.1 Is red-teaming/safety benchmarking explicitly allowed?
**Only with official authorization.** The Acceptable Use Policy explicitly states: "Don't circumvent safeguards unless you are part of an official Red Team or otherwise have our official blessing." Grok 4.1 integrates automated red-teaming agents internally.

### 4.2 What's explicitly banned?
- Circumventing safeguards without authorization
- Misleading people about nature/source of AI outputs
- Misrepresenting AI-generated images as real
- Use violating applicable laws
- Activities not safe or responsible for humanity

### 4.3 Research/academic exception?
**Not documented.** No public academic or research exception program found. The "official blessing" language suggests case-by-case approval but no formal pathway.

### 4.4 Responsible disclosure / bug bounty?
**YES.**
- HackerOne: https://hackerone.com/x
- Email: vulnerabilities@x.ai (subject: "Responsible Disclosure")
- Program is public and active
- Note: In 2025, a leaked API key with access to unreleased models went unrevoked for 2+ months -- suggesting inconsistent security posture

### 4.5 Violation consequences?
**Not well documented.** The consumer ToS reserves the right to terminate access. No documented graduated enforcement or appeal process found in public materials.

### 4.6 Ban scope?
**Likely affects X/Twitter.** Given xAI's integration with X (Twitter), a Grok ban may impact X account status, though this is not explicitly documented. The services are increasingly intertwined.

---

## 5. Mistral AI

### 5.1 Is red-teaming/safety benchmarking explicitly allowed?
**NO -- explicitly prohibited without authorization.** Commercial Terms of Service and all consumer ToS variants explicitly prohibit: "compromising or attempting to compromise the security or proper functionality of the Mistral AI Products, including interfering with, circumventing, or bypassing security or moderation mechanisms in the Mistral AI Products or performing any vulnerability, penetration, or similar testing of the Mistral AI Products."

### 5.2 What's explicitly banned?
- Vulnerability, penetration, or similar testing
- Circumventing security or moderation mechanisms
- Interfering with proper functionality
- Standard prohibited content categories

### 5.3 Research/academic exception?
**Not documented.** No public research access program or academic exception found. Open-weight models (Mistral 7B, Mixtral, etc.) under Apache 2.0 license can be self-hosted and tested freely -- this is the recommended path for adversarial research.

### 5.4 Responsible disclosure / bug bounty?
**Limited.** Vulnerability disclosure exists through their Trust Center (https://trust.mistral.ai) but no public bug bounty program with monetary rewards was found. Security vulnerabilities can be reported via their submission portal. No HackerOne/Bugcrowd presence identified.

### 5.5 Violation consequences?
**Not well documented.** Standard termination clauses in ToS. No published enforcement statistics or graduated response policy.

### 5.6 Ban scope?
**Mistral services only.** No cross-service implications beyond Mistral's own products (Le Chat, API, etc.).

---

## 6. Moonshot AI (Kimi)

### 6.1 Is red-teaming/safety benchmarking explicitly allowed?
**NO explicit provision.** No documented red-teaming program or safety research exception. The ToS prohibits "attempting to reverse-engineer, hack, or exploit the service."

### 6.2 What's explicitly banned?
- Generating harmful, illegal, malicious, or inappropriate content
- Reverse-engineering, hacking, or exploiting the service
- Unauthorized access attempts
- Using outputs for consequential decisions about individuals (credit, employment, housing, insurance, legal, medical)
- All content prohibited under Chinese law

### 6.3 Research/academic exception?
**Not documented.** No public academic exception found.

### 6.4 Responsible disclosure / bug bounty?
**Not documented.** No public bug bounty or vulnerability disclosure program found.

### 6.5 Violation consequences?
**Opaque.** Subject to Chinese regulatory enforcement in addition to platform ToS. Data stored on servers in China, subject to Chinese legal jurisdiction and potential government access.

### 6.6 Ban scope?
**Kimi platform only.** No known cross-service implications. However, usage data is retained under Chinese jurisdiction and could theoretically be shared with Chinese authorities under applicable law.

### 6.7 Special considerations
- **Chinese regulatory overlay:** Subject to CAC (Cyberspace Administration of China) regulations
- **Data sovereignty:** All data processed/stored in China
- **Anthropic distillation allegations:** In Feb 2026, Anthropic accused Moonshot (along with DeepSeek and MiniMax) of distillation attacks against Claude -- flooding it with specially-crafted prompts to train their own models

---

## 7. Zhipu AI / Z.ai (GLM / ChatGLM)

### 7.1 Is red-teaming/safety benchmarking explicitly allowed?
**Not documented.** No public red-teaming program found. Rebranded from Zhipu AI to Z.ai in 2025.

### 7.2 What's explicitly banned?
- Content violating Chinese law (including political censorship requirements)
- Standard harmful content categories
- Specific censorship of politically sensitive topics (Taiwan, Tibet, Tiananmen, Xinjiang, etc. -- standard for all Chinese AI providers)

### 7.3 Research/academic exception?
**Partial.** Founded by Tsinghua University professors; strong academic ties. Open-weight models (GLM-4.5 at 355B params, GLM-4.7) released under Apache 2.0 -- can be self-hosted for unrestricted research.

### 7.4 Responsible disclosure / bug bounty?
**Not documented.** No public program found.

### 7.5 Violation consequences?
**Opaque.** Subject to Chinese regulatory enforcement. Government censorship requirements are non-negotiable for the API service.

### 7.6 Ban scope?
**Z.ai platform only.** Self-hosted open-weight models are unaffected.

### 7.7 Special considerations
- **Government censorship is hardcoded into API responses** -- the model will refuse politically sensitive topics regardless of prompt
- Open to government customers in China and abroad (as of 2026)
- Self-hosted models can be fine-tuned to remove censorship filters

---

## 8. DeepSeek

### 8.1 Is red-teaming/safety benchmarking explicitly allowed?
**NO explicit provision for the API.** However, extensive third-party red-teaming has been conducted without apparent enforcement action (Promptfoo, Enkrypt AI, CSA, Microsoft Azure, etc.), suggesting de facto tolerance.

### 8.2 What's explicitly banned?
Per the Open Platform Terms of Service:
- Violation of national or international laws
- Military use of any kind
- Exploitation or harm of minors
- Generating verifiably false information to harm others
- Illegal or inappropriate content under applicable regulations
- Network intrusion / reverse engineering
- Use in sanctioned countries or by sanctioned parties

### 8.3 Research/academic exception?
**De facto yes for open-weight models.** DeepSeek-R1 is MIT-licensed (fully permissive). DeepSeek-V3/V3.2 use a custom OpenRAIL-derived license with use restrictions in Attachment A. Self-hosted deployment removes all API ToS constraints. For the API, no formal research exception exists.

### 8.4 Responsible disclosure / bug bounty?
**Not documented.** No public bug bounty program found. DeepSeek has been the subject of extensive external red-teaming reports without any known enforcement against the testers.

### 8.5 Violation consequences?
**Can be severe and immediate.** DeepSeek reserves the right to: issue warnings, restrict account functions, suspend usage, lock/close accounts, prohibit re-registration, and delete content -- all WITHOUT prior notification.

### 8.6 Ban scope?
**DeepSeek platform only.** No cross-service implications. Open-weight models are completely independent.

### 8.7 Special considerations
- **Self-hosted is the clear path:** DeepSeek-R1 (MIT license) can be hosted and red-teamed freely
- API is subject to Chinese regulatory compliance
- The Stanford FMTI Transparency Report noted limited transparency from DeepSeek on enforcement practices
- Third-party red-teaming appears widely tolerated in practice

---

## 9. Alibaba / Qwen

### 9.1 Is red-teaming/safety benchmarking explicitly allowed?
**Not explicitly.** Usage Policy exists at qwen.ai/usagepolicy but does not appear to include explicit red-teaming provisions. Qwen3Guard (their safety system) was developed with internal adversarial testing.

### 9.2 What's explicitly banned?
- Standard harmful content categories (violence, CSAM, hate speech)
- Non-violent illegal activities (hacking guidance, unauthorized drug production, theft)
- Sexual imagery involving identifiable individuals
- Content violating Chinese law
- Companies with 100M+ monthly active users are restricted from using certain models (Qwen-VL) without special license
- Model scraping prohibited

### 9.3 Research/academic exception?
**Partial via open weights.** Qwen models are released as open-weight under various licenses. Self-hosted testing is unrestricted by API ToS. No formal API research exception program found.

### 9.4 Responsible disclosure / bug bounty?
**Not documented** as a standalone program. Alibaba Cloud has broader security programs, but no Qwen-specific bounty found.

### 9.5 Violation consequences?
**Standard termination.** Account suspension/termination per Alibaba Cloud and Qwen Chat ToS.

### 9.6 Ban scope?
**Could affect Alibaba Cloud.** Qwen is an Alibaba product; violations could theoretically impact broader Alibaba Cloud services, though this is not explicitly documented.

### 9.7 Special considerations
- Chinese regulatory compliance required for API
- Open-weight models can be self-hosted for unrestricted research
- Alibaba has expressed concerns about Chinese AI models being used to process sensitive Western enterprise data

---

## 10. MiniMax

### 10.1 Is red-teaming/safety benchmarking explicitly allowed?
**NO.** No documented red-teaming program. ToS explicitly prohibits unauthorized access attempts and interference with services.

### 10.2 What's explicitly banned?
- Using robots, spiders, or automatic devices to access services
- Monitoring or copying material without written consent
- Interfering with proper working of services
- Introducing malicious code
- Attempting unauthorized access to any part of services
- Promoting illegal activity
- NSFW / harmful content generation

### 10.3 Research/academic exception?
**Not documented.** No public research exception found.

### 10.4 Responsible disclosure / bug bounty?
**Not documented.** No public program found.

### 10.5 Violation consequences?
**Not well documented.** Standard ToS termination clauses.

### 10.6 Ban scope?
**MiniMax platform only.** No known cross-service implications.

### 10.7 Special considerations
- **Distillation controversy:** In Feb 2026, Anthropic publicly accused MiniMax (along with DeepSeek and Moonshot) of running distillation attacks against Claude -- flooding it with large volumes of specially-crafted prompts to train proprietary models. This signals MiniMax may be more aggressive about data collection than other providers.
- Chinese regulatory compliance required
- Privacy policy updated Jan 2026

---

## 11. OpenRouter (Aggregator) -- CRITICAL SECTION

### 11.1 Does OpenRouter shield you from provider bans?
**NO. Emphatically no.**

Direct quote from OpenRouter's red-teaming documentation: "Any unauthorized Red Teaming will be flagged by OpenRouter's AND AI Model providers' monitoring systems and are likely to result in account and access termination by AI Model providers."

OpenRouter is a pass-through. Your prompts reach upstream providers. Their monitoring systems see your traffic. OpenRouter adds a layer but does NOT anonymize or protect you from individual provider enforcement.

### 11.2 OpenRouter's own policy
- Red-teaming on OpenRouter requires **prior written approval**
- Contact: safety@openrouter.ai
- Approval timeline: ~5 business days
- Approval is **case-by-case, not guaranteed**
- Benefits of approval: OpenRouter coordinates with providers to prevent your account from being flagged

### 11.3 What happens without approval?
- OpenRouter flags your account
- Upstream providers flag your account independently
- Result: **dual enforcement** -- both OpenRouter ban AND individual provider bans

### 11.4 Recommended approach
1. Email safety@openrouter.ai BEFORE any testing
2. Describe DystopiaBench as a safety evaluation benchmark (not adversarial attack tooling)
3. Specify which models/providers you intend to test
4. Request written confirmation
5. Keep approval documentation for liability protection

---

## Comprehensive Comparison Table

| Provider | Red-Team Allowed? | Explicit Bans | Research Exception | Bug Bounty | Violation = ? | Ban Scope | Self-Host Escape? |
|----------|-------------------|---------------|-------------------|------------|---------------|-----------|-------------------|
| **Anthropic** | YES (w/ program) | CBRN, CSAM, hate, sexual, cyber, disinfo | YES (Researcher Access Program + Fellows) | YES ($15K, HackerOne, safe harbor) | Graduated; can be immediate; 1.45M bans in H2 2025 | Anthropic ecosystem only | N/A (no open weights) |
| **OpenAI** | YES (w/ program) | Illegal, circumvention, misrepresentation | YES (Red Teaming Network, application) | YES ($100K max, HackerOne) | Can be immediate; appeal via Support | All OpenAI services + IP/payment | N/A (no open weights) |
| **Google** | Internal + structured | CSAM, extremism, NCII, self-harm, sexual, hate | LIMITED (VRP excludes jailbreaks) | YES ($30K, bughunters.google.com; excludes jailbreaks) | Graduated to PERMANENT + cross-service | **ENTIRE GOOGLE ACCOUNT** | N/A (no open weights) |
| **xAI** | Only w/ "official blessing" | Circumvention, misrepresentation | NOT DOCUMENTED | YES (HackerOne, vulnerabilities@x.ai) | Not well documented | Likely includes X/Twitter | Grok-1 open-weight (outdated) |
| **Mistral** | NO (explicitly prohibited) | Vuln testing, circumvention, interference | NOT DOCUMENTED | LIMITED (Trust Center, no bounty $) | Standard termination | Mistral only | **YES** (Apache 2.0 models) |
| **Moonshot/Kimi** | NO | Hacking, reverse-eng, harmful content | NOT DOCUMENTED | NOT DOCUMENTED | Opaque + Chinese regulatory | Kimi only | N/A |
| **Zhipu/Z.ai** | NOT DOCUMENTED | Chinese law, political censorship | Partial (academic ties) | NOT DOCUMENTED | Opaque + Chinese regulatory | Z.ai only | **YES** (Apache 2.0 models) |
| **DeepSeek** | NO (API); de facto tolerated | Military, minors, false info, intrusion | De facto (MIT/OpenRAIL weights) | NOT DOCUMENTED | Can be immediate, no notice | DeepSeek only | **YES** (MIT license for R1) |
| **Alibaba/Qwen** | NOT DOCUMENTED | Standard + Chinese law + model scraping | Partial (open weights) | NOT DOCUMENTED | Standard termination | Possibly Alibaba Cloud | **YES** (open weights) |
| **MiniMax** | NO | Unauthorized access, bots, malicious code | NOT DOCUMENTED | NOT DOCUMENTED | Standard termination | MiniMax only | N/A |
| **OpenRouter** | YES (w/ written approval) | Unauthorized red-teaming, jailbreaking | Via approval process | N/A | Dual: OpenRouter + upstream provider | OpenRouter account | N/A (aggregator) |

---

## Risk Matrix for DystopiaBench

### HIGH RISK (DO NOT test via API without formal approval)
| Provider | Why |
|----------|-----|
| **Google/Gemini** | Ban can cascade to ENTIRE Google Account (Gmail, Drive, Cloud, YouTube). Most dangerous provider to test against. |
| **OpenAI** | Universal ban across ChatGPT, API, DALL-E. $100K bug bounty exists but unauthorized testing risks full lockout. |
| **Moonshot/Kimi** | Opaque enforcement + Chinese regulatory overlay + data stored in China. |
| **MiniMax** | No transparency + distillation controversy + Chinese regulatory overlay. |

### MEDIUM RISK (proceed with caution)
| Provider | Why |
|----------|-----|
| **Anthropic** | Has the best research programs but still banned 1.45M accounts in 6 months. Apply to Bug Bounty or Researcher Access first. |
| **xAI/Grok** | "Official blessing" language exists but no clear application path. |

### LOW RISK (self-hosted open-weight models)
| Provider | Why |
|----------|-----|
| **DeepSeek R1** | MIT license. Self-host and test freely. Zero ToS risk. |
| **Mistral** | Apache 2.0 models. Self-host and test freely. |
| **Qwen** | Open weights available. Self-host and test freely. |
| **Zhipu/GLM** | Apache 2.0 models. Self-host and test freely. |

---

## Recommended Strategy for DystopiaBench

### Phase 1: Self-Hosted Models (ZERO RISK)
Test all open-weight models locally or on your own infrastructure:
- DeepSeek R1 (MIT) / DeepSeek V3.2 (OpenRAIL)
- Mistral models (Apache 2.0)
- Qwen models (open weights)
- GLM models (Apache 2.0)

### Phase 2: Apply for Formal Approval
Before testing any API-based model:
1. **OpenRouter:** Email safety@openrouter.ai with DystopiaBench description. Wait for written approval.
2. **Anthropic:** Apply to Model Safety Bug Bounty (HackerOne) or External Researcher Access Program
3. **OpenAI:** Apply to Safety Bug Bounty or Red Teaming Network
4. **Google:** Apply to AI VRP at bughunters.google.com (NOTE: jailbreaks/alignment issues are excluded from scope)

### Phase 3: API Testing with Approval
Only after receiving written approval:
- Use approved OpenRouter credentials
- Log all test sessions
- Stay within approved scope
- Report findings through established disclosure channels

### Phase 4: Responsible Disclosure
For any significant findings:
- Anthropic: disclosure@anthropic.com + HackerOne
- OpenAI: HackerOne + Safety Bug Bounty
- Google: bughunters.google.com
- xAI: vulnerabilities@x.ai
- All others: direct communication via support channels

---

## Chinese Provider Regulatory Overlay

All 4 Chinese providers (Moonshot, Zhipu, DeepSeek, Qwen/Alibaba) share common regulatory constraints:

1. **CAC (Cyberspace Administration of China) oversight** -- all generative AI services must comply with Interim Measures for Administration of Generative AI Services (effective Aug 2023)
2. **Content labeling requirements** -- GB 45438-2025 mandatory standard (effective Sep 2025)
3. **Political censorship hardcoded** -- Taiwan, Tibet, Tiananmen, Xinjiang, Hong Kong protests, and other politically sensitive topics are systematically filtered
4. **Data residency** -- all data processed on Chinese servers, subject to Chinese government access
5. **Filing requirement** -- services must register with CAC, display model names and filing numbers
6. **2025 AI Plus Action Plan** -- targeting 70% AI penetration in key sectors by 2027

**Implication for DystopiaBench:** Any adversarial testing of Chinese provider APIs will inherently be testing both the model's safety AND the Chinese government's censorship requirements. These are fundamentally different from Western safety guardrails and should be analyzed separately in benchmark results.

---

## Sources

### Anthropic
- [Anthropic Usage Policy Update](https://www.anthropic.com/news/usage-policy-update)
- [Responsible Disclosure Policy](https://www.anthropic.com/responsible-disclosure-policy)
- [Model Safety Bug Bounty](https://www.anthropic.com/news/model-safety-bug-bounty)
- [Anthropic VDP on HackerOne](https://hackerone.com/anthropic-vdp)
- [External Researcher Access Program](https://support.claude.com/en/articles/9125743-what-is-the-external-researcher-access-program)
- [Exceptions to Usage Policy](https://support.claude.com/en/articles/9528712-exceptions-to-our-usage-policy)
- [Anthropic Transparency Hub](https://www.anthropic.com/transparency)
- [red.anthropic.com](https://red.anthropic.com)

### OpenAI
- [Usage Policies](https://openai.com/policies/usage-policies/)
- [Coordinated Vulnerability Disclosure Policy](https://openai.com/policies/coordinated-vulnerability-disclosure-policy/)
- [Bug Bounty Program](https://openai.com/index/bug-bounty-program/)
- [Safety Bug Bounty](https://openai.com/index/safety-bug-bounty/)
- [Red Teaming Network](https://openai.com/index/red-teaming-network/)
- [OpenAI on HackerOne](https://hackerone.com/open-ai)
- [Services Agreement](https://openai.com/policies/services-agreement/)

### Google
- [Gemini API Usage Policies / Abuse Monitoring](https://ai.google.dev/gemini-api/docs/usage-policies)
- [Generative AI Prohibited Use Policy](https://policies.google.com/terms/generative-ai/use-policy)
- [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms)
- [AI VRP Announcement](https://bughunters.google.com/blog/announcing-googles-new-ai-vulnerability-reward-program)
- [Safety Guidance](https://ai.google.dev/gemini-api/docs/safety-guidance)
- [Forum: Google Cloud access restricted after Gemini API](https://discuss.ai.google.dev/t/my-google-cloud-access-has-been-completely-restricted-after-using-gemini-api-is-this-a-mistake/111569)

### xAI
- [Acceptable Use Policy](https://x.ai/legal/acceptable-use-policy)
- [Consumer Terms of Service](https://x.ai/legal/terms-of-service)
- [xAI Security](https://x.ai/security)
- [X / xAI on HackerOne](https://hackerone.com/x)

### Mistral
- [Terms](https://legal.mistral.ai/terms)
- [Usage Policy](https://legal.mistral.ai/terms/usage-policy)
- [Commercial Terms of Service](https://legal.mistral.ai/terms/commercial-terms-of-service)
- [Trust Center](https://trust.mistral.ai/)

### Moonshot / Kimi
- [Kimi OpenPlatform Terms of Service](https://platform.moonshot.ai/docs/agreement/modeluse)
- [Kimi Privacy Policy](https://platform.moonshot.ai/docs/agreement/userprivacy)

### Zhipu / Z.ai
- [Z.ai Platform](https://www.zhipuai.cn/en)
- [ZHIPU AI Open Platform](https://bigmodel.cn/pricing)

### DeepSeek
- [Open Platform Terms of Service](https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html)
- [Terms of Use](https://cdn.deepseek.com/policies/en-US/deepseek-terms-of-use.html)
- [DeepSeek License FAQ](https://deepseeklicense.github.io/)
- [Stanford FMTI Transparency Report -- DeepSeek](https://crfm.stanford.edu/fmti/December-2025/company-reports/DeepSeek_FinalReport_FMTI2025.html)

### Alibaba / Qwen
- [Qwen Usage Policy](https://qwen.ai/usagepolicy)
- [Qwen Chat Terms of Service](https://chat.qwen.ai/legal-agreement/terms-of-service)

### MiniMax
- [MiniMax Terms of Service](https://www.minimax.io/platform/protocol/terms-of-service)
- [MiniMax App Terms of Service](https://agent.minimax.io/doc/en/terms-of-service.html)

### OpenRouter
- [Red Teaming / Adversarial Testing Policy](https://openrouter.ai/docs/guides/evaluate-and-optimize/red-teaming)
- [Terms of Service](https://openrouter.ai/terms)
- [Trust Center](https://trust.openrouter.ai/)

### Regulatory
- [China AI Regulatory Tracker -- White & Case](https://www.whitecase.com/insight-our-thinking/ai-watch-global-regulatory-tracker-china)
- [China AI Governance -- IAPP](https://iapp.org/resources/article/global-ai-governance-china)
- [Acceptable Use Policies for Foundation Models -- Stanford CRFM](https://crfm.stanford.edu/2024/04/08/aups.html)
