import { Link } from "react-router";
import { SearchX } from "lucide-react";
import { buttonStyles } from "../components/ui/Button";
import { EmptyState } from "../components/ui/feedback";

/** S24: missing, deleted or someone else's design. */
export function NotFound() {
  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <EmptyState
        icon={<SearchX />}
        title="We can't find that page"
        body="It may have been deleted, or it belongs to someone else."
        action={
          // one link that looks like a button (a link inside a <button> is two controls in one)
          <Link to="/" className={buttonStyles()}>
            Back to Home
          </Link>
        }
      />
    </div>
  );
}
