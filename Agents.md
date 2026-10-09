# Agent Instructions & Guidelines

This document defines mandatory operational rules and conventions for all AI agents working within this repository.

---

## 1. Git Commit & Push Policy

- **Explicit User Request Only**: Never commit or push changes automatically, proactively, or autonomously.
- **Strict Prohibition**: Do **not** execute `git commit` or `git push` unless the user explicitly commands you to do so (e.g., "commit this", "commit and push", "please push").
- If code or documentation edits are finished, simply present your summary to the user and await explicit instructions before touching git commits or pushes.

---

## 2. Pre-Commit Wikilink Conversion Rule

Before executing any commit (once explicitly requested by the user), the agent **must** perform a scan for wikilinks and convert all of them into standard Markdown links.

### Wikilink Syntax vs. Standard Markdown Format

Every instance of Obsidian/Roam-style wikilinks (`[[...]]`) in files being committed must be converted to standard Markdown syntax:

1. **Internal Heading Links with Alias:**
   - Wikilink: `[[#Heading Name|Display Text]]`
   - Standard Markdown: `[Display Text](#heading-name-slug)`
   - *Anchor Slug Rules:* Lowercase, replace spaces with hyphens, and remove special characters (standard GitHub Markdown anchor format).

2. **Internal Heading Links without Alias:**
   - Wikilink: `[[#Heading Name]]`
   - Standard Markdown: `[Heading Name](#heading-name-slug)`

3. **Inter-Note Links without Alias:**
   - Wikilink: `[[Note Name]]`
   - Standard Markdown: `[Note Name](path/to/Note%20Name.md)` (use proper relative path from the current file to the target).

4. **Inter-Note Links with Alias:**
   - Wikilink: `[[Note Name|Display Text]]`
   - Standard Markdown: `[Display Text](path/to/Note%20Name.md)`

5. **Inter-Note Links with Anchor:**
   - Wikilink: `[[Note Name#Heading|Display Text]]`
   - Standard Markdown: `[Display Text](path/to/Note%20Name.md#heading-slug)`

6. **Embedded Files / Images:**
   - Wikilink: `![[image.png]]` or `![[image.png|Alt Text]]`
   - Standard Markdown: `![Alt Text](path/to/image.png)`

---

## 3. Pre-Commit Execution Workflow

When the user explicitly instructs you to commit:

1. **Identify Modified Files**:
   - Check which Markdown (`.md`) files have been created or modified (via `git status` / `git diff`).
2. **Search for Wikilinks**:
   - Scan the modified files for occurrences of `\[\[.*?\]\]`.
3. **Convert to Standard Markdown**:
   - Replace each wikilink with its standard relative Markdown link equivalent.
4. **Verify**:
   - Run a final search or regex check to ensure zero wikilinks remain in the staged/modified content.
5. **Stage & Commit**:
   - Run `git add` and `git commit` with a concise, descriptive message.
6. **Push (Only If Requested)**:
   - Run `git push` only if the user explicitly requested pushing to the remote repository.
