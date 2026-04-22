import { useNavigate } from "react-router-dom";

type Props = {
  fallback: string;
  label?: string;
};

export const BackButton = ({ fallback, label = "Back" }: Props) => {
  const navigate = useNavigate();

  return (
    <button
      className="ghost-btn"
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate(fallback);
        }
      }}
    >
      {label}
    </button>
  );
};
