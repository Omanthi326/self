import { Link } from "react-router-dom";
import LecturerSidebar from "./LecturerSidebar";
import { useState, useEffect } from "react";
import axios from "axios";

const baseUrl = "http://127.0.0.1:8000/api";

function LecturerCourses() {
  const [courseData, setCourseData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const lecturerId = localStorage.getItem('lecturerId');
  
  // fetch courses
  useEffect(() => {
    setIsLoading(true);
    try {
      axios.get(`${baseUrl}/lecturer-course/${lecturerId}`)
        .then((res) => {
          setCourseData(res.data);
          setIsLoading(false);
        })
        .catch(error => {
          console.error("Error fetching courses:", error);
          setIsLoading(false);
        });
    } catch (error) {
      console.error("Error in useEffect:", error);
      setIsLoading(false);
    }
  }, [lecturerId]);

  
  
  return (
    <div className="container py-4">
      <div className="row g-4">
        <aside className="col-md-3">
          <LecturerSidebar />
        </aside>
        <section className="col-md-9">
          <div className="card shadow-sm border-0">
            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center py-3">
              <h5 className="m-0">My Courses</h5>
              <Link to="/add-courses" className="btn btn-light btn-sm">
                <i className="bi bi-plus-circle me-1"></i> Add New Course
              </Link>
            </div>
            <div className="card-body">
              {isLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Loading your courses...</p>
                </div>
              ) : courseData.length === 0 ? (
                <div className="text-center py-5">
                  <div className="mb-3">
                    <i className="bi bi-book fs-1 text-muted"></i>
                  </div>
                  <h5>No courses found</h5>
                  <p className="text-muted">Start by creating your first course</p>
                  <Link to="/add-course" className="btn btn-primary mt-2">
                    Create Course
                  </Link>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle">
                    <thead className="table-light">
                      <tr>
                        <th scope="col">Course</th>
                        <th scope="col" className="text-center">Students</th>
                        <th scope="col" className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courseData.map((course, index) => (
                        <tr key={course.id}>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="course-img-container me-3">
                                {course.featured_img ? (
                                  <img 
                                    src={course.featured_img} 
                                    width="80" 
                                    height="60"
                                    className="rounded object-fit-cover" 
                                    alt={course.title}
                                  />
                                ) : (
                                  <div className="placeholder-img bg-light rounded d-flex align-items-center justify-content-center" style={{width: "80px", height: "60px"}}>
                                    <i className="bi bi-image text-muted"></i>
                                  </div>
                                )}
                              </div>
                              <div>
                                <h6 className="mb-1">{course.title}</h6>
                                <span className="badge bg-light text-dark">{course.category || "Uncategorized"}</span>
                              </div>
                            </div>
                          </td>
                          <td className="text-center">
                            <Link to={`/user-list`} className="text-decoration-none">
                              <span className="ms-1 text-primary small">View All</span>
                            </Link>
                          </td>
                          <td>
                            <div className="d-flex justify-content-center gap-2 flex-wrap">
                              <Link to={`/edit-course/${course.id}`} className="btn btn-outline-primary btn-sm">
                                <i className="bi bi-pencil-square me-1"></i> Edit
                              </Link>
                             
                              <Link to={`/add-assignment/${course.id}`} className="btn btn-outline-info btn-sm">
                                <i className="bi bi-clipboard-check me-1"></i> Assignments
                              </Link>
                              <button className="btn btn-outline-danger btn-sm">
                                <i className="bi bi-trash me-1"></i> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default LecturerCourses;