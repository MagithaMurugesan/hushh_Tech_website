/**
 * Community Post — Logic / ViewModel
 * Slug parsing, post lookup, NDA access check, loading state.
 * UI stays in post-ui.tsx — zero rendering here.
 */
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useToast } from "@chakra-ui/react";
import axios from "axios";
import { getPostBySlug, PostData } from "../../data/posts";
import config from "../../resources/config/config";
import { useAuthSession } from "../../auth/AuthSessionProvider";

export const useCommunityPostLogic = () => {
  const { "*": slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { session, status } = useAuthSession();
  const toastShownRef = useRef<Record<string, boolean>>({});

  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);

  /** Show a toast only once per key to avoid duplicates */
  const showToastOnce = (id: string, options: any) => {
    if (!toastShownRef.current[id]) {
      toast(options);
      toastShownRef.current[id] = true;
    }
  };

  useEffect(() => {
    const loadPost = async () => {
      const foundPost = getPostBySlug(slug || "");

      /* post not found */
      if (!foundPost) {
        showToastOnce(`post-not-found-${slug}`, {
          title: "Post Not Found",
          description: `The post with slug "${slug}" was not found.`,
          status: "error",
          duration: 4000,
          isClosable: true,
        });
        navigate("/community");
        return;
      }

      /* NDA-protected post — verify access */
      if (foundPost.accessLevel === "NDA") {
        if (status === "booting") {
          return;
        }

        if (status !== "authenticated" || !session?.access_token) {
          showToastOnce("access-restricted-no-session", {
            title: "Access Restricted",
            description:
              "You must be logged in and complete the NDA process to view confidential posts.",
            status: "error",
            duration: 4000,
            isClosable: true,
          });
          navigate("/community");
          return;
        }

        try {
          const response = await axios.post(
            "https://gsqmwxqgqrgzhlhmbscg.supabase.co/rest/v1/rpc/check_access_status",
            {},
            {
              headers: {
                apikey: config.SUPABASE_ANON_KEY,
                Authorization: `Bearer ${session.access_token}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (response.data !== "Approved") {
            showToastOnce("access-restricted-nda", {
              title: "Access Restricted",
              description:
                "You are not approved to view this confidential post. Please complete the NDA process.",
              status: "error",
              duration: 4000,
              isClosable: true,
            });
            navigate("/community");
            return;
          }
        } catch (error) {
          console.error("Error checking NDA status:", error);
          showToastOnce("access-error-nda", {
            title: "Error",
            description:
              "Error checking NDA access status. Please try again later.",
            status: "error",
            duration: 4000,
            isClosable: true,
          });
          navigate("/community");
          return;
        }
      }

      /* all checks passed */
      setPost(foundPost);
      setLoading(false);
    };

    void loadPost();
  }, [navigate, session?.access_token, slug, status, toast]);

  const handleBack = () => navigate("/community");

  return {
    post,
    loading,
    handleBack,
  };
};
