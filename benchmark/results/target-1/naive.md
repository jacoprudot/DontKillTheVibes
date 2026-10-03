# Problems Found in the Repository

## 1. Error Handling in Data Fetching (Workspace Layout)
**File:** `app/[locale]/[workspaceid]/layout.tsx`  
**Issue:** The `fetchWorkspaceData` function does not handle errors from database queries (e.g., `getWorkspaceById`, `getAssistantWorkspacesByWorkspaceId`). If any query fails, the loading state is never set to `false`, leaving the app stuck in a loading state indefinitely.

## 2. Incorrect Language Attribute in Root Layout
**File:** `app/[locale]/layout.tsx` (root layout)  
**Issue:** The `<html>` tag has a hardcoded `lang="en"` attribute, ignoring the `locale` from the URL parameters. This breaks i18n accessibility and SEO, as the language should reflect the user's selected locale (e.g., `lang="de"` for German).

## 3. Sensitive Information Leakage in Login Flow
**File:** `app/[locale]/login/page.tsx`  
**Issue:** Error messages during sign-in, sign-up, and password reset include raw Supabase error details (e.g., `error.message`) in redirect URLs (e.g., `/login?message=${error.message}`). This risks leaking sensitive information (like whether an email exists) and aids in user enumeration attacks.

## 4. Missing Home Workspace Handling in Setup
**File:** `app/[locale]/setup/page.tsx`  
**Issue:** The `handleSaveSetupSetting` function assumes a home workspace always exists (`const homeWorkspace = workspaces.find(w => w.is_home); ... setSelectedWorkspace(homeWorkspace!)`). If no home workspace is found (contradicting the comment), accessing `homeWorkspace!.id` throws a runtime error.

## 5. Incorrect Provider String in Groq API Key Check
**File:** `app/api/chat/groq/route.ts`  
**Issue:** The `checkApiKey` call uses `"G"` as the provider string: `checkApiKey(profile.groq_api_key, "G")`. This results in unhelpful error messages like `"G API Key not found"` instead of `"Groq API Key not found"`.

## 6. Hardcoded Model Limits in OpenAI Route
**File:** `app/api/chat/openai/route.ts`  
**Issue:** The `max_tokens` value is hardcoded for specific models (`gpt-4-vision-preview` and `gpt-4o`) with a `TODO: Fix` comment. It does not use the centralized `CHAT_SETTING_LIMITS` object (used by other routes like Groq/Mistral), leading to inconsistency and potential inaccuracies for other models.

## 7. Flawed Tool Request Logic in Tools Route
**File:** `app/api/chat/tools/route.ts`  
**Issue:**  
- The request type (body vs. query) is determined solely by the first route in the tool's schema (`convertedSchema.routes[0].requestInBody`), which is incorrect if the tool has multiple endpoints with different requirements (e.g., one GET endpoint using query and one POST using body).  
- No handling for tools with empty route arrays, causing `convertedSchema.routes[0]` to be `undefined`.

## 8. Inconsistent Token Limit in Command Route
**File:** `app/api/command/route.ts`  
**Issue:** The `max_tokens` uses `CHAT_SETTING_LIMITS["gpt-4-turbo-preview"]` while the model is `"gpt-4-1106-preview"`. These are different model names, so the limit may not apply correctly, risking truncation or errors.

## 9. Missing Embeddings Provider Validation
**File:** `app/api/retrieval/process/route.ts`  
**Issue:** The function does not validate the `embeddingsProvider` parameter (expected: `"openai"` or `"local"`). Invalid values fall through to the `local` branch without generating embeddings, storing files without embeddings and causing silent failures during retrieval.

## 10. Unvalidated Source Count in Retrieval Route
**File:** `app/api/retrieval/retrieve/route.ts`  
**Issue:** The `sourceCount` parameter (used in Supabase RPC calls) is not validated. Non-numeric, negative, or zero values could cause errors or unexpected behavior in the `match_file_items` functions.

## 11. Unhandled Auth Callback Errors
**File:** `app/auth/callback/route.ts`  
**Issue:** The `exchangeCodeForSession` call lacks error handling. If it fails (e.g., invalid code), the promise rejection is unhandled, and the user receives no feedback, potentially leaving them stuck on the callback page.

## 12. Misleading Help Text for Shortcuts
**File:** `components/chat/chat-help.tsx`  
**Issue:** The help text claims shortcuts require ⌘ + Shift modifiers (e.g., "Show Help" uses ⌘ + Shift + /). However, the actual hotkeys (e.g., `useHotkey("/", ...)` to open the help dropdown) require no modifiers. This misleads users about the correct key combinations.

## 13. Stream Processing of Error Responses in Chat Handler
**File:** `components/chat/chat-hooks/use-chat-handler.tsx`  
**Issue:** In `fetchChatResponse`, when the HTTP response is not ok (e.g., 401/404), the function returns the error response but the caller (`handleLocalChat`/`handleHostedChat`) still attempts to process it via `processResponse`. This risks trying to parse an error JSON as a stream, causing runtime errors.

## 14. Chat History Index Not Reset on New Messages
**File:** `components/chat/chat-hooks/use-chat-history.tsx`  
**Issue:** The `messageHistoryIndex` state is not updated when new messages are added. After sending a message, pressing Arrow Up may show an outdated message instead of the previous user message, breaking history navigation.

## 15. Space-Sensitive Command Detection Breaks File Names with Spaces
**File:** `components/chat/chat-hooks/use-prompt-and-command.tsx`  
**Issue:** The regex for detecting commands (e.g., `/@([^ ]*)$/` for `@`) requires the command to be the last word with no trailing space. This prevents using file names with spaces in the file picker (e.g., `#my file` fails to trigger, requiring `#myfile` instead), which is unintuitive and unusable for spaced file names.

## 16. Incorrect Icon for Text Files
**File:** `components/chat/chat-hooks/use-select-file-handler.tsx`  
**Issue:** Text files (MIME type `text/plain`) are stored with subtype `plain` and displayed using a generic file icon. The UI in `chat-files-display.tsx` does not map `plain` to `txt`, so text files lack a distinct icon (unlike PDF, CSV, etc.).

## 17. Placeholder Text Formatting Issue
**File:** `components/chat/chat-input.tsx`  
**Issue:** The placeholder text has extra spaces: `Ask anything. Type @  /  #  !` (double spaces between symbols). While minor, it affects polish and consistency.

## 18. Missing Error Handling in Chat UI Data Fetching
**File:** `components/chat/chat-ui.tsx`  
**Issue:** The `fetchData` function (which fetches messages and chat data) lacks error handling. If either `fetchMessages` or `fetchChat` fails, the loading state is never set to `false` (as `setLoading(false)` is only called on success), leaving the app stuck in a loading state.
