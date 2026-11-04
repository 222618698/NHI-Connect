package za.nhiconnect.domain;

import jakarta.persistence.*;
import java.util.UUID;
import java.time.LocalDate;

@Entity
@Table(name = "patient")
public class Patient {
    @Id
    @Column(name = "patient_id")
    private UUID id;
    @Column(name = "national_id")
    private String nationalId;
    @Column(name = "first_name")
    private String firstName;
    private String surname;
    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;
    private String sex;

    public UUID getId() { return id; }
    public String getNationalId() { return nationalId; }
    public String getFirstName() { return firstName; }
    public String getSurname() { return surname; }
    public LocalDate getDateOfBirth() { return dateOfBirth; }
    public String getSex() { return sex; }
}
