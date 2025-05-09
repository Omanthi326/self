import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

function LecturerAssignmentView() {
    const { assignment_id } = useParams();
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [assignmentDetails, setAssignmentDetails] = useState(null);

    useEffect(() => {
        const fetchSubmissionsAndDetails = async () => {
            try {
                const lecturerLoginStatus = localStorage.getItem("lecturerLoginStatus");
                const lecturerId = localStorage.getItem("lecturerId");

                if (lecturerLoginStatus !== "true" || !lecturerId) {
                    setError('Not authorized. Please login as lecturer.');
                    setLoading(false);
                    return;
                }

                // Fetch assignment details
                const detailsResponse = await axios.get(
                    `http://127.0.0.1:8000/api/assignment/${assignment_id}/`
                );
                setAssignmentDetails(detailsResponse.data);

                // Fetch submissions for this assignment
                // This is the important part - we need to ensure we're getting ALL submissions
                const submissionsResponse = await axios.get(
                    `http://127.0.0.1:8000/api/assignment/${assignment_id}/submissions/`
                );
                
                // Make sure we're getting an array of submissions 
                if (Array.isArray(submissionsResponse.data)) {
                    setSubmissions(submissionsResponse.data);
                } else if (submissionsResponse.data.submissions && Array.isArray(submissionsResponse.data.submissions)) {
                    // In case the API returns an object with a submissions array
                    setSubmissions(submissionsResponse.data.submissions);
                } else {
                    console.error('Unexpected submissions data format:', submissionsResponse.data);
                    setError('Failed to load submissions: Unexpected data format');
                }
            } catch (err) {
                console.error('Error fetching data:', err);
                setError(err.response?.data?.message || 'Failed to fetch submissions');
            } finally {
                setLoading(false);
            }
        };

        fetchSubmissionsAndDetails();
    }, [assignment_id]);

    const handleGradeSubmission = async (submissionId, grade, feedback) => {
        try {
            await axios.post(`http://127.0.0.1:8000/api/submission/${submissionId}/grade/`, {
                grade,
                feedback
            });

            // Update the submissions list after grading
            setSubmissions(submissions.map(sub =>
                sub.id === submissionId
                    ? { ...sub, grade, feedback, status: 'graded' }
                    : sub
            ));
        } catch (err) {
            console.error('Error grading submission:', err);
            alert('Failed to grade submission. Please try again.');
        }
    };

    if (loading) {
        return (
            <div className="container mt-3">
                <div className="alert alert-info">
                    Loading submissions...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mt-3">
                <div className="alert alert-danger">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="container mt-3">
            {assignmentDetails && (
                <div className="card mb-4">
                    <div className="card-header bg-primary text-white">
                        <h3>{assignmentDetails.title}</h3>
                    </div>
                    <div className="card-body">
                        <p><strong>Due Date:</strong> {new Date(assignmentDetails.due).toLocaleDateString()}</p>
                        <p><strong>Total Submissions:</strong> {submissions.length}</p>
                        <p><strong>Graded:</strong> {submissions.filter(s => s.status === 'graded').length}</p>
                        <p><strong>Pending:</strong> {submissions.filter(s => s.status === 'submitted').length}</p>
                    </div>
                </div>
            )}

            <div className="card">
                <div className="card-header bg-secondary text-white">
                    <h4>Student Submissions</h4>
                </div>
                <ul className="list-group list-group-flush">
                    {submissions.length === 0 ? (
                        <li className="list-group-item text-muted">
                            No submissions yet.
                        </li>
                    ) : (
                        // Group submissions by student_id (if available) or by student_name
                        // to ensure we show all submissions from all students
                        submissions.map((submission, index) => (
                            <li key={submission.id || index} 
                                className={`list-group-item ${submission.status === 'graded' ? 'border-success' : ''}`}>
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h5 className="mb-1">{submission.student_name}</h5>
                                        <small className="text-muted">
                                            Submitted: {new Date(submission.submitted_at).toLocaleDateString()} 
                                            {submission.submitted_at && 
                                             ` at ${new Date(submission.submitted_at).toLocaleTimeString()}`}
                                        </small>
                                        {submission.status === 'graded' && (
                                            <div className="mt-2">
                                                <span className="badge bg-success me-2">
                                                    Grade: {submission.grade}/100
                                                </span>
                                                <small className="text-muted">
                                                    Feedback: {submission.feedback}
                                                </small>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <a
                                            href={submission.file}
                                            className="btn btn-primary btn-sm me-2"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Download
                                        </a>
                                        {submission.web_similarity_score !== undefined && (
                                            <span className="badge bg-info me-2">
                                                Similarity: {submission.web_similarity_score}%
                                            </span>
                                        )}
                                        {submission.status !== 'graded' && (
                                            <button
                                                className="btn btn-success btn-sm"
                                                onClick={() => {
                                                    const grade = prompt('Enter grade (0-100):');
                                                    if (grade === null) return;
                                                    const feedback = prompt('Enter feedback:');
                                                    if (feedback === null) return;
                                                    
                                                    const numericGrade = parseInt(grade);
                                                    if (isNaN(numericGrade) || numericGrade < 0 || numericGrade > 100) {
                                                        alert('Please enter a valid grade between 0 and 100');
                                                        return;
                                                    }
                                                    
                                                    handleGradeSubmission(submission.id, numericGrade, feedback);
                                                }}
                                            >
                                                Grade
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            </div>

            <div className="mt-3">
                <Link 
                    to={`/course/${assignmentDetails?.course}`} 
                    className="btn btn-secondary"
                >
                    Back to Course
                </Link>
            </div>
        </div>
    );
}

export default LecturerAssignmentView;