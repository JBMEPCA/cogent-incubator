"use client";

import { deleteBlackBookContact } from "@/lib/black-book-actions";

// Asks first: the Black Book is a record kept for months, and one stray click
// on a row should not lose a contact nobody wrote down anywhere else.
export default function BlackBookDelete({ id, company }) {
  return (
    <form
      action={deleteBlackBookContact.bind(null, id)}
      onSubmit={(e) => {
        if (!window.confirm(`Remove ${company} from the Black Book?`)) e.preventDefault();
      }}
    >
      <button type="submit" className="btn-ghost" aria-label={`Remove ${company}`}>
        Remove
      </button>
    </form>
  );
}
