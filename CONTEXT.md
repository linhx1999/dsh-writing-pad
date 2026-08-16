# Writing Pad

This context separates what the user says in a conversation from the document and focused guidance carried by the writing workflow.

## Language

**Conversation message**:
The user's current message in the main conversation composer. It remains ordinary user-authored content even when a draft accompanies it.
_Avoid_: Additional instruction, rewrite note

**Draft context**:
The complete writing-pad document attached to a conversation message so the model can read or modify it.
_Avoid_: Conversation message, additional instruction

**Additional instruction**:
Focused guidance entered in the writing pad for changing a selected passage.
_Avoid_: Conversation message, draft context
