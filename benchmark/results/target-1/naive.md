# Problems Found in the Repository

## 1. Incomplete Error Message in Login Test
**File:** `__tests__/playwright-test/tests/login.spec.ts`  
**Issue:** The test for "No password for signup" expects the error message `"Signup requires a valid"`, which is incomplete. The actual backend likely returns a more specific message like `"Signup requires a valid email"`. This will cause the test to fail if the backend message differs.

## 2. Incorrect Service Name in Groq API Key Check
**File:** `app/api/chat/groq/route.ts`  
**Issue:** The `checkApiKey` function is called with `"G"` as the service name instead of `"Groq"`. This results in misleading error messages (e.g., `"G API Key not found"` instead of `"Groq API Key not found"`).

## 3. Undefined max_tokens in OpenRouter Route
**File:** `app/api/chat/openrouter/route.ts`  
**Issue:** The `max_tokens` parameter is set to `undefined` when calling the OpenAI SDK. The OpenAI SDK expects `max_tokens` to be a number or `null`, not `undefined`. This may cause runtime errors or unexpected behavior.

## 4. Incorrect requestInBody Handling in Tools Route
**File:** `app/api/chat/tools/route.ts`  
**Issue:** The `requestInBody` flag is determined solely from the first route in the OpenAPI schema (`convertedSchema.routes[0].requestInBody`), regardless of which specific operation (route) is being invoked. If a tool schema contains multiple routes with different `requestInBody` settings (e.g., one using query parameters and another using a request body), the wrong setting will be used for non-first routes, leading to failed API calls.

## 5. Duplicate Key Handler in Chat Input
**File:** `components/chat/chat-input.tsx`  
**Issue:** The `handleKeyDown` function contains duplicate conditions for `shift+ctrl+up` and `shift+ctrl+down` (appearing twice). While harmless, this is redundant and indicates potential copy-paste errors.

## 6. Missing Minimum Value Clamping in Chat Settings
**File:** `components/chat/chat-settings.tsx`  
**Issue:** The `useEffect` hook only clamps the *maximum* values for `temperature` and `contextLength` (using `Math.min` with the upper limit). It does not enforce *minimum* values (e.g., `temperature` could be set to a negative number, which is invalid for most LLMs). The `CHAT_SETTING_LIMITS` likely defines both min and max, but only the max is used.

## 7. Overriding User Settings in Chat UI
**File:** `components/chat/chat-ui.tsx`  
**Issue:** In the `fetchMessages` function, `setUseRetrieval(true)` and `setShowFilesDisplay(true)` are called unconditionally after loading a chat. This overrides the user's global preferences for retrieval and file display, forcing them to be enabled and visible regardless of prior user settings.

## 8. TODO: Fix max_tokens for Vision Models (Multiple Files)
**Files:**  
- `app/api/chat/azure/route.ts`  
- `app/api/chat/openai/route.ts`  
**Issue:** Both files contain a `TODO: Fix` comment regarding the `max_tokens` setting for vision models (`gpt-4-vision-preview` and `gpt-4o`). Currently, `max_tokens` is hardcoded to `4096` for these models, but the comment indicates this is incorrect and needs adjustment. This is a known issue requiring resolution.
