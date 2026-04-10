import { useEffect, useRef, useState } from "react";
import { detect, init } from "../utils/utils";


export default function FaceExpression({ onClick = () => { } }) {
    const videoRef = useRef(null);
    const landmarkerRef = useRef(null);
    const streamRef = useRef(null);

    const [ expression, setExpression ] = useState("Detecting...");
    const [ permissionState, setPermissionState ] = useState(null);
    const isPermissionDenied = permissionState === "denied";
    const isPermissionPending = permissionState !== "granted" && !isPermissionDenied;
    const isCameraUnavailable = expression === "Camera unavailable" || expression === "Requesting camera...";
    const statusLabel = isPermissionDenied
        ? "Camera blocked"
        : isPermissionPending
            ? "Camera waiting"
            : "Camera ready";
    const noticeTitle = isPermissionDenied
        ? "Camera access is blocked"
        : isPermissionPending
            ? "We need camera permission"
            : isCameraUnavailable
                ? "Camera is warming up"
                : "Mood scan active";
    const noticeText = isPermissionDenied
        ? "Open your browser settings and allow camera access so the scanner can read your expression."
        : isPermissionPending
            ? "Allow camera access to unlock the live mood scanner and auto-pick matching songs."
            : isCameraUnavailable
                ? "Your camera is starting up. If it does not appear, retry the camera request below."
                : "Hold your face inside the frame and tap Detect expression to refresh your mood.";

    useEffect(() => {
        let isMounted = true;
        const videoElement = videoRef.current;
        const landmarker = landmarkerRef.current;

        const friendlyMessage = (error) => {
            if (!error) return "Camera unavailable";
            switch (error.name) {
                case "NotAllowedError":
                case "PermissionDeniedError":
                    return "Camera access denied. Allow camera in your browser or system settings.";
                case "NotFoundError":
                    return "No camera found. Connect a camera and retry.";
                case "NotReadableError":
                    return "Camera is in use by another application.";
                case "OverconstrainedError":
                    return error.message || "No camera matches constraints.";
                default:
                    return error.message || "Camera unavailable";
            }
        };

        const start = async () => {
            try {
                // read permission state if supported
                if (navigator.permissions && navigator.permissions.query) {
                    try {
                        const status = await navigator.permissions.query({ name: "camera" });
                        setPermissionState(status.state);
                        status.onchange = () => setPermissionState(status.state);
                    } catch {
                        // ignore unsupported permission name
                    }
                }

                if (permissionState === "denied") {
                    if (isMounted) setExpression("Camera permission denied. Open browser settings to allow camera.");
                    return;
                }

                await init({ landmarkerRef, videoRef, streamRef });
                if (isMounted) setExpression("Detecting...");
            } catch (error) {
                if (isMounted) {
                    console.error("Failed to initialize face detector", error);
                    setExpression(friendlyMessage(error));
                }
            }
        };

        start();

        // detection will run only when user clicks the Detect button

        return () => {
            isMounted = false;

            if (landmarker) {
                landmarker.close();
            }

            if (videoElement?.srcObject) {
                videoElement.srcObject
                    .getTracks()
                    .forEach((track) => track.stop());
            }

            // nothing additional to cleanup for detection loop
        };
    }, [permissionState]);

    async function handleClick() {
        const expression = detect({ landmarkerRef, videoRef, setExpression });
        onClick(expression);
    }

    async function handleRetry() {
        setExpression("Requesting camera...");
        try {
            await init({ landmarkerRef, videoRef, streamRef });
            setExpression("Detecting...");
            if (navigator.permissions && navigator.permissions.query) {
                try {
                    const status = await navigator.permissions.query({ name: "camera" });
                    setPermissionState(status.state);
                } catch (error) {
                    void error;
                }
            }
        } catch (error) {
            console.error("Retry failed", error);
            const msg = (error && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError"))
                ? "Camera access denied. Allow camera in your browser or system settings."
                : (error?.message || "Camera unavailable");
            setExpression(msg);
        }
    }


    return (
        <div className="face-expression">
            <div className="face-expression__top">
                <div className="face-expression__headline">
                    <p className="face-expression__eyebrow">Live mood scan</p>
                    <h2 className="face-expression__title">Camera mood scanner</h2>
                </div>
                <span className={`face-expression__status-chip face-expression__status-chip--${permissionState || "unknown"}`}>
                    {statusLabel}
                </span>
            </div>

            <div className="face-expression__camera-shell">
                <div className="face-expression__frame">
                    <video
                        ref={videoRef}
                        className="face-expression__video"
                        playsInline
                    />
                    <div className="face-expression__frame-overlay">
                        <span className="face-expression__frame-pill">Center your face</span>
                        <span className="face-expression__frame-pill face-expression__frame-pill--soft">
                            {expression}
                        </span>
                    </div>
                </div>
            </div>

            <div className={`face-expression__notice-panel face-expression__notice-panel--${permissionState || "unknown"}`}>
                <div className="face-expression__notice-copy">
                    <p className="face-expression__notice-title">{noticeTitle}</p>
                    <p className="face-expression__notice-text">{noticeText}</p>
                </div>

                <div className="face-expression__permissions">
                    {isPermissionDenied ? (
                        <button className="face-expression__secondary-action" onClick={handleRetry}>Retry camera</button>
                    ) : isPermissionPending || isCameraUnavailable ? (
                        <button className="face-expression__secondary-action" onClick={handleRetry}>Allow camera</button>
                    ) : null}
                    <button
                        className="face-expression__action"
                        onClick={handleClick}
                        disabled={isPermissionDenied || isCameraUnavailable}
                    >
                        Detect expression
                    </button>
                </div>
            </div>

            <div className="face-expression__footer">
                <p className="face-expression__copy">
                    Keep your face inside the frame, then press Detect expression to update your mood and playlist.
                </p>
            </div>
        </div>
    );
}
